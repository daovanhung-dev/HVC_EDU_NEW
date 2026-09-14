#!/usr/bin/env python3
"""Parse September 2026 attendance workbooks and generate a SQL migration.

The workbooks are xlsm containers without VBA. Some cells contain formulas
whose cached values are the only trustworthy import values because referenced
workbooks are not part of this repository. This module reads cached OOXML
values instead of evaluating formulas.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "docs" / "data_seed" / "t9"
MIGRATION_PATH = ROOT / "supabase" / "migrations" / "0035_seed_t9_attendance.sql"

NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "office_rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "package_rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}

STATUS_MAP = {
    "Có mặt": "PRESENT",
    "Đi muộn": "LATE",
    "Vắng": "ABSENT",
    "Vắng Có phép": "EXCUSED",
    "Có phép": "EXCUSED",
}

T7_ALIASES = {
    "Nghiêm Trung Hiếu": "Hiếu",
    "Trương Thủy Tiên": "Cẩm Tiên",
    "Nguyễn Bảo An": "Bảo An",
    "Nguyễn Hải Đăng": "Đăng",
    "Đào Ngọc Lan": "Lan",
}

# These are roster codes, not database UUIDs. The generated SQL resolves the
# actual UUID from student_code at migration time.
ROSTER_CODES = {
    "TOAN-6": {
        "Đào Thị Kim Ngân": "HS06-001",
        "Đặng Phương Anh": "HS06-002",
        "Nguyễn Gia Bảo": "HS06-003",
        "Nguyễn Đặng Gia Bảo": "HS06-004",
        "Tuệ Lâm": "HS06-005",
        "Đặng Khánh Linh": "HS06-006",
        "Nguyễn Ngọc Diệp": "HS06-007",
        "Nguyễn Ngọc Cẩm Tú": "HS06-008",
        "Đào Thế Hoàng": "HS06-009",
        "Đào Nguyễn Bình An": "HS06-010",
        "Nguyễn Trà My": "HS06-011",
        "Bảo Dũng": "HS06-012",
        "Đào Quang Minh": "HS06-013",
        "Duy": "HS06-014",
        "Phúc": "HS06-015",
        "Linh": "HS06-016",
        "Hân": "HS06-017",
        "Kiều Anh": "HS06-018",
        "Khang": "HS06-019",
    },
    "TOAN-7": {
        "Lê Ngọc Ánh": "HS07-001",
        "Nguyễn Thị Hồng Hạnh": "HS07-002",
        "Nguyễn Văn Phúc": "HS07-003",
        "Đào Thành Lê": "HS07-004",
        "Bùi Bảo Minh Anh": "HS07-005",
        "Cao Nhật Minh": "HS07-006",
        "Phạm Mạnh Hùng": "HS07-007",
        "Hiếu": "HS07-008",
        "Cẩm Tiên": "HS07-009",
        "Bảo An": "HS07-010",
        "Đăng": "HS07-011",
        "Lan": "HS07-012",
    },
    "TOAN-9": {
        "Trường An": "HS09-001",
        "Như Quỳnh": "HS09-002",
        "Huy Đức": "HS09-003",
        "Anh Trọng": "HS09-004",
        "Nguyễn Gia Bảo": "HS09-005",
        "Phạm Đức Hùng": "HS09-006",
        "Quân": "HS09-007",
        "Phương Nhi": "HS09-008",
        "Lê Bảo Châm": "HS09-009",
    },
}


@dataclass(frozen=True)
class BlockSpec:
    filename: str
    sheet: str
    block: str
    status_col: int
    class_code: str
    source_class_label: str
    session_date: dt.date
    schedule_start: str
    schedule_end: str
    teacher_label: str
    assistant_label: str
    reason: str
    name_columns: tuple[int, ...]
    end_row: int
    session_note: str | None = None
    session_note_reference: str | None = None
    lesson_label: str | None = None


@dataclass(frozen=True)
class SourceRow:
    class_code: str
    session_date: dt.date
    schedule_start: str
    schedule_end: str
    student_code: str
    source_name: str
    source_file: str
    source_sheet: str
    source_block: str
    source_row: int
    status_raw: str | None
    attendance_status: str | None
    late_minutes: int | None
    absence_reason: str | None
    homework_raw: str | None
    homework_score: float | None
    homework_note: str | None
    understanding_raw: str | None
    understanding_score: int | None
    attitude_raw: str | None
    attitude_score: int | None
    positive_feedback_raw: str | None
    positive_feedback_count: int | None
    comment_raw: str | None

    @property
    def import_source_key(self) -> str:
        return f"t9:{self.session_date.isoformat()}:{self.class_code}:{self.student_code}"


@dataclass(frozen=True)
class SessionSource:
    spec: BlockSpec
    rows: tuple[SourceRow, ...]

    @property
    def expected_revenue_rows(self) -> int:
        return sum(row.attendance_status in {"PRESENT", "LATE"} for row in self.rows)

    @property
    def complete_expected(self) -> bool:
        return all(row.attendance_status is not None for row in self.rows)


def column_number(cell_ref: str) -> int:
    match = re.match(r"([A-Z]+)", cell_ref)
    if not match:
        raise ValueError(f"Invalid cell reference: {cell_ref}")
    result = 0
    for character in match.group(1):
        result = result * 26 + ord(character) - ord("A") + 1
    return result


def _load_workbook(path: Path) -> dict[str, dict[int, dict[int, str]]]:
    """Return sheet -> row -> column -> cached displayed value."""

    with zipfile.ZipFile(path) as archive:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        rel_targets = {
            item.attrib["Id"]: item.attrib["Target"]
            for item in relationships.findall(f"{{{NS['package_rel']}}}Relationship")
        }

        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in shared_root.findall("main:si", NS):
                shared_strings.append("".join(text.text or "" for text in item.findall(".//main:t", NS)))

        sheets: dict[str, dict[int, dict[int, str]]] = {}
        for sheet in workbook.findall("main:sheets/main:sheet", NS):
            name = sheet.attrib["name"]
            relationship_id = sheet.attrib[f"{{{NS['office_rel']}}}id"]
            target = rel_targets[relationship_id]
            if not target.startswith("xl/"):
                target = f"xl/{target.lstrip('/')}"
            sheet_root = ET.fromstring(archive.read(target))
            rows: dict[int, dict[int, str]] = {}
            for row in sheet_root.findall(".//main:sheetData/main:row", NS):
                row_number = int(row.attrib["r"])
                values: dict[int, str] = {}
                for cell_node in row.findall("main:c", NS):
                    value_node = cell_node.find("main:v", NS)
                    cell_type = cell_node.attrib.get("t")
                    if cell_type == "inlineStr":
                        value = "".join(text.text or "" for text in cell_node.findall(".//main:t", NS))
                    elif value_node is None:
                        value = ""
                    else:
                        raw_value = value_node.text or ""
                        if cell_type == "s":
                            value = shared_strings[int(raw_value)]
                        elif cell_type == "b":
                            value = "TRUE" if raw_value == "1" else "FALSE"
                        else:
                            # Read cached <v>, even when the cell also has <f>.
                            value = raw_value
                    if value != "":
                        values[column_number(cell_node.attrib["r"])] = value
                if values:
                    rows[row_number] = values
            sheets[name] = rows
        return sheets


def cell(rows: dict[int, dict[int, str]], row: int, column: int) -> str | None:
    value = rows.get(row, {}).get(column)
    return value if value not in (None, "") else None


def clean(value: str | None) -> str | None:
    if value is None:
        return None
    result = value.strip()
    return result if result else None


def parse_number(value: str | None) -> float | None:
    value = clean(value)
    if value is None:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def parse_integer(value: str | None) -> int | None:
    number = parse_number(value)
    if number is None or not number.is_integer():
        return None
    return int(number)


def normalize_status(value: str | None) -> tuple[str | None, str | None]:
    raw = clean(value)
    if raw is None:
        return None, None
    if raw not in STATUS_MAP:
        raise ValueError(f"Unsupported attendance status: {raw}")
    status = STATUS_MAP[raw]
    return status, "Có phép" if status == "EXCUSED" else None


def normalize_t7_name(value: str) -> str:
    value = " ".join(value.split())
    return T7_ALIASES.get(value, value)


def _source_name(
    rows: dict[int, dict[int, str]],
    row: int,
    columns: tuple[int, ...],
    class_code: str,
) -> tuple[str, str]:
    raw_parts = [cell(rows, row, column) or "" for column in columns]
    raw_name = " ".join(part for part in raw_parts if part != "")
    normalized = normalize_t7_name(raw_name) if class_code == "TOAN-7" else " ".join(raw_name.split())
    return raw_name, normalized


def parse_block(spec: BlockSpec) -> SessionSource:
    workbook = _load_workbook(SOURCE_DIR / spec.filename)
    if spec.sheet not in workbook:
        raise ValueError(f"Missing sheet {spec.sheet!r} in {spec.filename}")
    rows = workbook[spec.sheet]
    source_rows: list[SourceRow] = []
    for row_number in range(6, spec.end_row + 1):
        raw_name, name = _source_name(rows, row_number, spec.name_columns, spec.class_code)
        if not name:
            continue
        student_code = ROSTER_CODES.get(spec.class_code, {}).get(name)
        if student_code is None:
            raise ValueError(
                f"Unknown {spec.class_code} student {name!r} at "
                f"{spec.filename}:{spec.sheet}:{row_number}"
            )
        status_raw = clean(cell(rows, row_number, spec.status_col))
        attendance_status, absence_reason = normalize_status(status_raw)
        feedback_raw = clean(cell(rows, row_number, spec.status_col + 1))
        homework_raw = clean(cell(rows, row_number, spec.status_col + 2))
        understanding_raw = clean(cell(rows, row_number, spec.status_col + 3))
        comment_raw = clean(cell(rows, row_number, spec.status_col + 4))
        attitude_raw = clean(cell(rows, row_number, spec.status_col + 5))
        positive_count = parse_integer(feedback_raw)
        homework_score = parse_number(homework_raw)
        homework_note = homework_raw if homework_raw and homework_score is None else None
        understanding_score = parse_integer(understanding_raw)
        attitude_score = parse_integer(attitude_raw)
        if understanding_score is not None and not 1 <= understanding_score <= 5:
            raise ValueError(f"Understanding score out of range at row {row_number}")
        if attitude_score is not None and not 1 <= attitude_score <= 5:
            raise ValueError(f"Attitude score out of range at row {row_number}")
        if homework_score is not None and not 0 <= homework_score <= 10:
            raise ValueError(f"Homework score out of range at row {row_number}")
        source_rows.append(
            SourceRow(
                class_code=spec.class_code,
                session_date=spec.session_date,
                schedule_start=spec.schedule_start,
                schedule_end=spec.schedule_end,
                student_code=student_code,
                source_name=raw_name,
                source_file=spec.filename,
                source_sheet=spec.sheet,
                source_block=spec.block,
                source_row=row_number,
                status_raw=status_raw,
                attendance_status=attendance_status,
                late_minutes=None,
                absence_reason=absence_reason,
                homework_raw=homework_raw,
                homework_score=homework_score,
                homework_note=homework_note,
                understanding_raw=understanding_raw,
                understanding_score=understanding_score,
                attitude_raw=attitude_raw,
                attitude_score=attitude_score,
                positive_feedback_raw=feedback_raw,
                positive_feedback_count=positive_count,
                comment_raw=comment_raw,
            )
        )
    if not source_rows:
        raise ValueError(f"No students found in {spec.filename}:{spec.sheet}:{spec.block}")
    return SessionSource(spec=spec, rows=tuple(source_rows))


def block_specs() -> tuple[BlockSpec, ...]:
    return (
        BlockSpec(
            "Diem_danh_6.xlsm", "Form đánh giá", "J5", 10, "TOAN-6", "6.0",
            dt.date(2026, 9, 3), "17:30", "19:30", "Mạnh Cường", "Duy",
            "Đủ 19 học sinh; block D5 chỉ có 18 và các block lớp 9 không thuộc Toán 6.",
            (2, 3), 24,
            "Nhìn chung cả lớp đều hiểu bài tuy nhiên mất trật tự rất nhiều", "6-9!A38",
        ),
        BlockSpec(
            "Diem_danh_7.xlsm", "Trang tính1", "D5", 4, "TOAN-7", "7.0",
            dt.date(2026, 9, 4), "17:30", "19:30", "Phương Anh", "Quang Duy",
            "Block ngày 04/09 có đủ roster Toán 7.", (2, 3), 17,
        ),
        BlockSpec(
            "Diem_danh_7.xlsm", "Trang tính1", "J5", 10, "TOAN-7", "9.0",
            dt.date(2026, 9, 6), "08:00", "10:00", "Phương Anh", "Quang Duy",
            "Sửa nhãn lớp 9 thành TOAN-7 theo roster và lịch; giữ Cao Nhật Minh trong snapshot vì thiếu trạng thái.",
            (2, 3), 17,
        ),
        BlockSpec(
            "Diem_danh_7.xlsm", "Trang tính1", "P5", 16, "TOAN-7", "9.0",
            dt.date(2026, 9, 11), "17:30", "19:30", "Mạnh Cường", "Hà Anh",
            "Sửa nhãn lớp 9 thành TOAN-7 theo roster và lịch; giữ Cao Nhật Minh trong snapshot vì thiếu trạng thái.",
            (2, 3), 17,
        ),
        BlockSpec(
            "Diem_danh_7.xlsm", "Trang tính1", "V5", 22, "TOAN-7", "9.0",
            dt.date(2026, 9, 13), "08:00", "10:00", "Mạnh Cường", "Hà Anh",
            "Chọn block ngày 13/09 đủ 12 học sinh; sửa nhãn lớp 9 thành TOAN-7 theo roster và lịch.",
            (2, 3), 17,
        ),
        BlockSpec(
            "Diem_danh_9.xlsm", "Form đánh giá ", "C5", 3, "TOAN-9", "9.0",
            dt.date(2026, 9, 3), "17:30", "19:30", "Thầy dạy thay", "Hà Anh",
            "Block ngày 03/09 có dữ liệu; giữ nguyên nhãn giáo viên Thầy dạy thay trong metadata.",
            (2,), 14, lesson_label="BUỔI 22: GIẢI PHƯƠNG TRÌNH",
        ),
        BlockSpec(
            "Diem_danh_9.xlsm", "Form đánh giá ", "I5", 9, "TOAN-9", "9.0",
            dt.date(2026, 9, 7), "17:30", "19:30", "Nguyễn Mạnh Cường", "Phương Anh",
            "Block ngày 07/09 có dữ liệu; bỏ block dọc trùng.", (2,), 14,
            "Lớp có tinh thần hoc tập ổn và chăm chú nghe bài. Tuy nhiên vẫn còn những nhược điểm sau: Bạn An, Đức đi học muộn và một số bạn quên mang compa. Trong giờ học một số em vẫn còn ồn ào gây ảnh hưởng tới lớp học bao gồm các em sau: An, Hùng, Đức. Mong thời gian tới lớp đi học đúng giờ, mang đầy đủ thiết bị học tập và giữ trật tự cũng như tôn trọng giáo viên để đạt được kết quả cao trong học tập. ",
            "Form đánh giá !I15", "BUỔI 23: CUNG VÀ DÂY CỦA 1 ĐƯỜNG TRÒN.",
        ),
        BlockSpec(
            "Diem_danh_9.xlsm", "Form đánh giá ", "O5", 15, "TOAN-9", "9.0",
            dt.date(2026, 9, 10), "17:30", "19:30", "Nguyễn Mạnh Cường", "Tiền",
            "Block ngày 10/09 có dữ liệu; bỏ các bản sao và block ngày 14/09 trống.",
            (2,), 14, lesson_label="BUỔI 24: CUNG VÀ DÂY CỦA 1 ĐƯỜNG TRÒN (TIẾP)",
        ),
    )


def parse_all() -> tuple[SessionSource, ...]:
    sessions = tuple(parse_block(spec) for spec in block_specs())
    keys = [
        row.import_source_key
        for session in sessions
        for row in session.rows
        if row.attendance_status
    ]
    if len(keys) != len(set(keys)):
        raise ValueError("Duplicate import_source_key")
    return sessions


def sql_literal(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)
    escaped = str(value).replace("'", "''")
    return f"'{escaped}'"


def json_sql(value: Any) -> str:
    serialized = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return f"{sql_literal(serialized)}::jsonb"


def source_snapshot(row: SourceRow) -> dict[str, Any]:
    return {
        "import_batch": "t9_2026_09",
        "source_file": row.source_file,
        "source_sheet": row.source_sheet,
        "source_block": row.source_block,
        "source_row": row.source_row,
        "student_code": row.student_code,
        "source_name": row.source_name,
        "status_raw": row.status_raw,
        "attendance_status": row.attendance_status,
        "positive_feedback_raw": row.positive_feedback_raw,
        "homework_raw": row.homework_raw,
        "understanding_raw": row.understanding_raw,
        "attitude_raw": row.attitude_raw,
        "comment_raw": row.comment_raw,
    }


def session_metadata(session: SessionSource) -> dict[str, Any]:
    spec = session.spec
    result: dict[str, Any] = {
        "import_batch": "t9_2026_09",
        "source_file": spec.filename,
        "source_sheet": spec.sheet,
        "source_block": spec.block,
        "source_class_label": spec.source_class_label,
        "source_teacher_label": spec.teacher_label,
        "source_assistant_label": spec.assistant_label,
        "block_selection_reason": spec.reason,
        "timezone": "Asia/Ho_Chi_Minh",
        "source_row_count": len(session.rows),
        "assessment_snapshot_count": len(session.rows),
        "attendance_count": sum(row.attendance_status is not None for row in session.rows),
    }
    if spec.lesson_label:
        result["source_lesson_label"] = spec.lesson_label
    if spec.session_note_reference:
        result["session_note_source"] = spec.session_note_reference
    return result


def generate_sql(sessions: tuple[SessionSource, ...]) -> str:
    rows = [row for session in sessions for row in session.rows]
    lines: list[str] = [
        "-- Generated from docs/data_seed/t9/*.xlsm by scripts/import_t9_attendance.py.",
        "-- Source workbook formulas are not evaluated; cached OOXML values are imported.",
        "-- This migration is fail-closed: any existing conflicting row aborts the transaction.",
        "do $$",
        "declare",
        "  v_actor uuid;",
        "  v_session record;",
        "begin",
        "  select p.user_id into v_actor",
        "  from public.profiles p",
        "  where p.role = 'ROOT_ADMIN' and p.status = 'ACTIVE'",
        "  order by p.created_at, p.user_id",
        "  limit 1;",
        "  if v_actor is null then raise exception 'T9_IMPORT_NO_ACTIVE_ROOT_ADMIN'; end if;",
        "",
        "  create temporary table t9_import_sessions (",
        "    class_code text not null,",
        "    session_date date not null,",
        "    schedule_start time not null,",
        "    schedule_end time not null,",
        "    source_metadata jsonb not null,",
        "    session_note text,",
        "    complete_expected boolean not null,",
        "    expected_revenue_rows integer not null,",
        "    primary key (class_code, session_date, schedule_start, schedule_end)",
        "  ) on commit drop;",
        "",
        "  create temporary table t9_import_rows (",
        "    class_code text not null,",
        "    session_date date not null,",
        "    schedule_start time not null,",
        "    schedule_end time not null,",
        "    student_code text not null,",
        "    import_source_key text not null unique,",
        "    status_raw text,",
        "    attendance_status text,",
        "    late_minutes integer,",
        "    absence_reason text,",
        "    homework_raw text,",
        "    homework_score numeric(4,2),",
        "    homework_note text,",
        "    understanding_score smallint,",
        "    attitude_score smallint,",
        "    positive_feedback_count integer,",
        "    positive_feedback_raw text,",
        "    comment_raw text,",
        "    assessment_snapshot jsonb not null,",
        "    primary key (class_code, session_date, schedule_start, schedule_end, student_code)",
        "  ) on commit drop;",
        "",
        "  insert into pg_temp.t9_import_sessions values",
    ]
    session_values = []
    for session in sessions:
        spec = session.spec
        session_values.append(
            "    ("
            + ", ".join(
                [
                    sql_literal(spec.class_code),
                    sql_literal(spec.session_date.isoformat()),
                    f"{sql_literal(spec.schedule_start)}::time",
                    f"{sql_literal(spec.schedule_end)}::time",
                    json_sql(session_metadata(session)),
                    sql_literal(spec.session_note),
                    sql_literal(session.complete_expected),
                    str(session.expected_revenue_rows),
                ]
            )
            + ")"
        )
    lines.append(",\n".join(session_values) + ";")
    lines.extend(["", "  insert into pg_temp.t9_import_rows values"])
    row_values = []
    for row in rows:
        row_values.append(
            "    ("
            + ", ".join(
                [
                    sql_literal(row.class_code),
                    sql_literal(row.session_date.isoformat()),
                    f"{sql_literal(row.schedule_start)}::time",
                    f"{sql_literal(row.schedule_end)}::time",
                    sql_literal(row.student_code),
                    sql_literal(row.import_source_key),
                    sql_literal(row.status_raw),
                    sql_literal(row.attendance_status),
                    sql_literal(row.late_minutes),
                    sql_literal(row.absence_reason),
                    sql_literal(row.homework_raw),
                    sql_literal(row.homework_score),
                    sql_literal(row.homework_note),
                    sql_literal(row.understanding_score),
                    sql_literal(row.attitude_score),
                    sql_literal(row.positive_feedback_count),
                    sql_literal(row.positive_feedback_raw),
                    sql_literal(row.comment_raw),
                    json_sql(source_snapshot(row)),
                ]
            )
            + ")"
        )
    lines.append(",\n".join(row_values) + ";")
    lines.extend(
        [
            "",
            "  create temporary table t9_resolved on commit drop as",
            "  select r.*,",
            "    cm.id as class_month_id, cms.id as schedule_id, s.id as session_id,",
            "    ss.id as session_student_id, st.id as student_id,",
            "    s.status as current_session_status, s.started_at, s.ended_at, s.revenue_snapshot,",
            "    s.import_metadata as current_import_metadata, s.session_note as current_session_note",
            "  from pg_temp.t9_import_rows r",
            "  join public.classes c on c.code = r.class_code",
            "  join public.class_months cm on cm.class_id = c.id and cm.year = 2026 and cm.month = 9",
            "  join public.class_month_schedules cms on cms.class_month_id = cm.id",
            "    and cms.status = 'ACTIVE'",
            "    and cms.day_of_week = extract(isodow from r.session_date)::integer",
            "    and cms.start_time = r.schedule_start and cms.end_time = r.schedule_end",
            "  join public.sessions s on s.class_month_id = cm.id and s.schedule_id = cms.id",
            "    and s.scheduled_start_at = ((r.session_date + r.schedule_start) at time zone 'Asia/Ho_Chi_Minh')",
            "  join public.students st on st.student_code = r.student_code",
            "  join public.session_students ss on ss.session_id = s.id and ss.student_id = st.id;",
            "",
            f"  if (select count(*) from pg_temp.t9_import_sessions) <> {len(sessions)} then",
            "    raise exception 'T9_IMPORT_SESSION_PAYLOAD_INVALID';",
            "  end if;",
            f"  if (select count(*) from pg_temp.t9_import_rows) <> {len(rows)} then",
            "    raise exception 'T9_IMPORT_ROW_PAYLOAD_INVALID';",
            "  end if;",
            f"  if (select count(*) from pg_temp.t9_resolved) <> {len(rows)} then",
            "    raise exception 'T9_IMPORT_LOOKUP_FAILED_EXPECTED_ROWS';",
            "  end if;",
            "  if exists (select 1 from pg_temp.t9_resolved where current_session_status = 'CANCELLED') then",
            "    raise exception 'T9_IMPORT_SESSION_CANCELLED';",
            "  end if;",
            "  if exists (select 1 from pg_temp.t9_resolved where attendance_status is not null and attendance_status not in ('PRESENT','LATE','ABSENT','EXCUSED')) then",
            "    raise exception 'T9_IMPORT_STATUS_MAPPING_INVALID';",
            "  end if;",
            "",
            "  if exists (",
            "    select 1 from pg_temp.t9_resolved r",
            "    join public.student_attendances a on a.session_id = r.session_id and a.student_id = r.student_id",
            "    where r.attendance_status is null or a.import_source_key is distinct from r.import_source_key",
            "      or a.status::text is distinct from r.attendance_status",
            "      or a.late_minutes is distinct from r.late_minutes",
            "      or a.absence_reason is distinct from r.absence_reason",
            "      or a.homework_score is distinct from r.homework_score",
            "      or a.homework_note is distinct from r.homework_note",
            "      or a.understanding_score is distinct from r.understanding_score",
            "      or a.attitude_score is distinct from r.attitude_score",
            "      or a.positive_feedback_count is distinct from r.positive_feedback_count",
            "      or a.positive_feedback_raw is distinct from r.positive_feedback_raw",
            "      or a.comment is distinct from r.comment_raw",
            "  ) then raise exception 'T9_IMPORT_ATTENDANCE_CONFLICT'; end if;",
            "",
            "  if exists (",
            "    select 1 from pg_temp.t9_resolved r",
            "    join public.student_attendances a on a.import_source_key = r.import_source_key",
            "    where a.session_id <> r.session_id or a.student_id <> r.student_id",
            "  ) then raise exception 'T9_IMPORT_SOURCE_KEY_CONFLICT'; end if;",
            "",
            "  if exists (",
            "    select 1 from pg_temp.t9_resolved r",
            "    join public.session_students ss on ss.id = r.session_student_id",
            "    where ss.assessment_snapshot <> r.assessment_snapshot",
            "      and ss.assessment_snapshot <> '{}'::jsonb",
            "  ) then raise exception 'T9_IMPORT_ASSESSMENT_SNAPSHOT_CONFLICT'; end if;",
            "",
            "  if exists (",
            "    select 1 from pg_temp.t9_resolved r",
            "    join pg_temp.t9_import_sessions i using (class_code, session_date, schedule_start, schedule_end)",
            "    where r.current_import_metadata <> '{}'::jsonb",
            "      and r.current_import_metadata <> i.source_metadata",
            "  ) then raise exception 'T9_IMPORT_SESSION_METADATA_CONFLICT'; end if;",
            "",
            "  if exists (",
            "    select 1 from pg_temp.t9_resolved r",
            "    join pg_temp.t9_import_sessions i using (class_code, session_date, schedule_start, schedule_end)",
            "    where r.current_session_note is not null and r.current_session_note is distinct from i.session_note",
            "  ) then raise exception 'T9_IMPORT_SESSION_NOTE_CONFLICT'; end if;",
            "",
            "  if exists (",
            "    select 1 from pg_temp.t9_resolved r",
            "    join pg_temp.t9_import_sessions i using (class_code, session_date, schedule_start, schedule_end)",
            "    where i.complete_expected and r.current_session_status not in ('SCHEDULED','COMPLETED')",
            "  ) then raise exception 'T9_IMPORT_COMPLETION_STATUS_CONFLICT'; end if;",
            "  if exists (",
            "    select 1 from pg_temp.t9_resolved r",
            "    join pg_temp.t9_import_sessions i using (class_code, session_date, schedule_start, schedule_end)",
            "    where not i.complete_expected and r.current_session_status <> 'SCHEDULED'",
            "  ) then raise exception 'T9_IMPORT_PARTIAL_SESSION_STATUS_CONFLICT'; end if;",
            "  if exists (",
            "    select 1 from pg_temp.t9_resolved r",
            "    join pg_temp.t9_import_sessions i using (class_code, session_date, schedule_start, schedule_end)",
            "    where i.complete_expected and r.current_session_status = 'COMPLETED'",
            "      and r.current_import_metadata = '{}'::jsonb",
            "  ) then raise exception 'T9_IMPORT_MANUAL_COMPLETED_SESSION_CONFLICT'; end if;",
            "",
            "  update public.session_students ss",
            "  set assessment_snapshot = r.assessment_snapshot",
            "  from pg_temp.t9_resolved r",
            "  where ss.id = r.session_student_id and ss.assessment_snapshot = '{}'::jsonb;",
            "",
            "  insert into public.student_attendances (",
            "    session_id, student_id, status, late_minutes, absence_reason, homework_score, homework_note,",
            "    understanding_score, attitude_score, positive_feedback_count, positive_feedback_raw, comment, updated_by, import_source_key",
            "  )",
            "  select session_id, student_id, attendance_status::public.attendance_status, late_minutes, absence_reason, homework_score, homework_note,",
            "    understanding_score, attitude_score, positive_feedback_count, positive_feedback_raw, comment_raw, v_actor, import_source_key",
            "  from pg_temp.t9_resolved r",
            "  where r.attendance_status is not null",
            "  on conflict (session_id, student_id) do nothing;",
            "",
            "  update public.sessions s",
            "  set import_metadata = i.source_metadata,",
            "      session_note = coalesce(s.session_note, i.session_note)",
            "  from (",
            "    select distinct r.session_id, i.source_metadata, i.session_note",
            "    from pg_temp.t9_resolved r",
            "    join pg_temp.t9_import_sessions i using (class_code, session_date, schedule_start, schedule_end)",
            "  ) i",
            "  where s.id = i.session_id and (s.import_metadata = '{}'::jsonb or s.session_note is null);",
            "",
            "  update public.sessions s",
            "  set status = 'COMPLETED', started_at = s.scheduled_start_at, started_by = v_actor,",
            "      ended_at = s.scheduled_end_at, ended_by = v_actor, revenue_snapshot = i.expected_revenue",
            "  from (",
            "    select distinct r.session_id, i.complete_expected,",
            "      (select coalesce(sum(ss2.session_unit_value), 0) from pg_temp.t9_resolved r2 join public.session_students ss2 on ss2.id = r2.session_student_id where r2.session_id = r.session_id and r2.attendance_status in ('PRESENT','LATE')) as expected_revenue",
            "    from pg_temp.t9_resolved r",
            "    join pg_temp.t9_import_sessions i using (class_code, session_date, schedule_start, schedule_end)",
            "  ) i",
            "  where s.id = i.session_id and i.complete_expected and s.status = 'SCHEDULED';",
            "",
            "  if exists (",
            "    select 1 from pg_temp.t9_resolved r",
            "    join pg_temp.t9_import_sessions i using (class_code, session_date, schedule_start, schedule_end)",
            "    where i.complete_expected and r.current_session_status = 'COMPLETED'",
            "      and (r.started_at is distinct from (r.session_date + r.schedule_start) at time zone 'Asia/Ho_Chi_Minh'",
            "        or r.ended_at is distinct from (r.session_date + r.schedule_end) at time zone 'Asia/Ho_Chi_Minh')",
            "  ) then raise exception 'T9_IMPORT_COMPLETED_SESSION_TIMES_CONFLICT'; end if;",
            "",
            "  for v_session in",
            "    select distinct r.session_id, i.complete_expected, i.expected_revenue_rows",
            "    from pg_temp.t9_resolved r",
            "    join pg_temp.t9_import_sessions i using (class_code, session_date, schedule_start, schedule_end)",
            "  loop",
            "    if not exists (select 1 from public.audit_logs where action = 'SESSION_IMPORT_T9' and entity_type = 'sessions' and entity_id = v_session.session_id) then",
            "      perform public.write_audit(",
            "        v_actor, 'SESSION_IMPORT_T9', 'sessions', v_session.session_id,",
            "        jsonb_build_object('status', 'SCHEDULED'),",
            "        jsonb_build_object('status', case when v_session.complete_expected then 'COMPLETED' else 'SCHEDULED' end, 'attendance_rows', v_session.expected_revenue_rows),",
            "        'Import attendance/assessment T9 09/2026 from docs/data_seed/t9'",
            "      );",
            "    end if;",
            "  end loop;",
        "end $$;",
        "",
        "-- No timesheet, payroll, tuition, or accounting rows are created by this import.",
    ])
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--generate", action="store_true", help="generate the SQL migration")
    parser.add_argument("--output", type=Path, default=MIGRATION_PATH)
    args = parser.parse_args()
    sessions = parse_all()
    rows = [row for session in sessions for row in session.rows]
    summary = {
        "sessions": len(sessions),
        "assessment_snapshots": len(rows),
        "attendance_rows": sum(row.attendance_status is not None for row in rows),
        "complete_sessions": sum(session.complete_expected for session in sessions),
        "scheduled_sessions_with_missing_status": sum(not session.complete_expected for session in sessions),
    }
    if args.generate:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(generate_sql(sessions), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
