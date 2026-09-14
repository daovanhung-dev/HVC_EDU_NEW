import unittest

from scripts.import_t9_attendance import (
    T7_ALIASES,
    generate_sql,
    normalize_status,
    normalize_t7_name,
    parse_all,
)


class T9AttendanceImportTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sessions = parse_all()
        cls.rows = [row for session in cls.sessions for row in session.rows]

    def test_expected_scope_counts(self):
        self.assertEqual(len(self.sessions), 8)
        self.assertEqual(len(self.rows), 94)
        self.assertEqual(sum(row.attendance_status is not None for row in self.rows), 92)
        self.assertEqual(sum(session.complete_expected for session in self.sessions), 6)
        self.assertEqual(sum(not session.complete_expected for session in self.sessions), 2)
        self.assertFalse(any(row.class_code == "TOAN-8" for row in self.rows))

    def test_t7_aliases_resolve_to_existing_short_names(self):
        self.assertEqual(len(T7_ALIASES), 5)
        for source_name, roster_name in T7_ALIASES.items():
            self.assertEqual(normalize_t7_name(source_name), roster_name)
        self.assertIn(
            "HS07-008",
            {row.student_code for row in self.rows if row.class_code == "TOAN-7"},
        )

    def test_status_mapping_and_missing_status(self):
        expected = {
            "Có mặt": "PRESENT",
            "Đi muộn": "LATE",
            "Vắng": "ABSENT",
            "Vắng Có phép": "EXCUSED",
            "Có phép": "EXCUSED",
        }
        for raw, status in expected.items():
            self.assertEqual(normalize_status(raw)[0], status)
        self.assertEqual(normalize_status(None), (None, None))

        incomplete = [
            session
            for session in self.sessions
            if session.spec.class_code == "TOAN-7"
            and session.spec.session_date.day in (6, 11)
        ]
        self.assertEqual(len(incomplete), 2)
        for session in incomplete:
            missing = [row for row in session.rows if row.attendance_status is None]
            self.assertEqual([row.student_code for row in missing], ["HS07-006"])
            self.assertEqual(len(session.rows), 12)

    def test_duplicate_and_special_raw_values_are_retained(self):
        t7_13 = next(
            session
            for session in self.sessions
            if session.spec.class_code == "TOAN-7"
            and session.spec.session_date.day == 13
        )
        self.assertEqual(t7_13.spec.block, "V5")
        self.assertEqual(len(t7_13.rows), 12)
        self.assertIn(
            "27+",
            {row.positive_feedback_raw for row in t7_13.rows},
        )

        t7_11 = next(
            session
            for session in self.sessions
            if session.spec.class_code == "TOAN-7"
            and session.spec.session_date.day == 11
        )
        self.assertIn(
            "Không có BTVN",
            {row.homework_note for row in t7_11.rows},
        )

        t9_03 = next(
            session
            for session in self.sessions
            if session.spec.class_code == "TOAN-9"
            and session.spec.session_date.day == 3
        )
        self.assertEqual(
            sum(row.attendance_status == "EXCUSED" for row in t9_03.rows),
            1,
        )

    def test_generated_sql_is_fail_closed_and_idempotent(self):
        sql = generate_sql(self.sessions)
        self.assertIn("student_attendances", sql)
        self.assertIn("assessment_snapshot", sql)
        self.assertIn("import_source_key", sql)
        self.assertIn("T9_IMPORT_ATTENDANCE_CONFLICT", sql)
        self.assertIn("on conflict (session_id, student_id) do nothing", sql)
        self.assertIn("'TOAN-7'", sql)
        self.assertNotIn("'TOAN-8'", sql)


if __name__ == "__main__":
    unittest.main()
