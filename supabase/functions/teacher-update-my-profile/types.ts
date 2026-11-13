export interface TeacherProfileInput {
  full_name: string
  phone: string
  email: string | null
  address: string | null
}

export interface TeacherProfileResult {
  staff_id: string
  full_name: string
}

export interface TeacherProfileCaller {
  user: { id: string }
  profile: { role: string; status: string }
}
