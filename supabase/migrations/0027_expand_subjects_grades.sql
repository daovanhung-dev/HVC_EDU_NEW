-- Expand academic master data to cover primary, lower-secondary and
-- upper-secondary grades. Existing codes remain stable for existing classes.

insert into public.subjects(code, name) values
  ('MATH', 'Toán'),
  ('LITERATURE', 'Văn'),
  ('ENGLISH', 'Tiếng Anh'),
  ('VIETNAMESE', 'Tiếng Việt'),
  ('ETHICS', 'Đạo đức'),
  ('NATURE_AND_SOCIETY', 'Tự nhiên và Xã hội'),
  ('SCIENCE', 'Khoa học'),
  ('HISTORY_AND_GEOGRAPHY', 'Lịch sử và Địa lý'),
  ('ARTS', 'Nghệ thuật'),
  ('MUSIC', 'Âm nhạc'),
  ('FINE_ARTS', 'Mỹ thuật'),
  ('EXPERIENTIAL_ACTIVITIES', 'Hoạt động trải nghiệm'),
  ('PHYSICAL_EDUCATION', 'Giáo dục thể chất'),
  ('INFORMATICS', 'Tin học'),
  ('TECHNOLOGY', 'Công nghệ'),
  ('CIVIC_EDUCATION', 'Giáo dục công dân'),
  ('NATURAL_SCIENCES', 'Khoa học tự nhiên'),
  ('SOCIAL_SCIENCES', 'Khoa học xã hội'),
  ('PHYSICS', 'Vật lý'),
  ('CHEMISTRY', 'Hóa học'),
  ('BIOLOGY', 'Sinh học'),
  ('HISTORY', 'Lịch sử'),
  ('GEOGRAPHY', 'Địa lý'),
  ('ECONOMICS_LAW', 'Giáo dục kinh tế và pháp luật'),
  ('NATIONAL_DEFENSE_SECURITY', 'Giáo dục quốc phòng và an ninh')
on conflict (code) do update set name = excluded.name;

insert into public.grades(code, name) values
  ('GRADE_1', 'Khối 1'),
  ('GRADE_2', 'Khối 2'),
  ('GRADE_3', 'Khối 3'),
  ('GRADE_4', 'Khối 4'),
  ('GRADE_5', 'Khối 5'),
  ('GRADE_6', 'Khối 6'),
  ('GRADE_7', 'Khối 7'),
  ('GRADE_8', 'Khối 8'),
  ('GRADE_9', 'Khối 9'),
  ('GRADE_10', 'Khối 10'),
  ('GRADE_11', 'Khối 11'),
  ('GRADE_12', 'Khối 12')
on conflict (code) do update set name = excluded.name;
