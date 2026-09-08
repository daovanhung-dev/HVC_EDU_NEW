import { supabase } from './supabase'

export interface FunctionError {
  code: string
  message: string
}

export interface FunctionResponse<T> {
  success: boolean
  data?: T
  error?: FunctionError
  trace_id?: string
}

export async function invokeFunction<TInput extends Record<string, unknown>, TOutput>(
  name: string,
  body: TInput,
): Promise<TOutput> {
  const { data, error } = await supabase.functions.invoke<FunctionResponse<TOutput>>(name, { body })
  if (error) {
    const context = await error.context?.json?.().catch(() => null)
    const message = context?.error?.message || error.message
    const domainError = new Error(message) as Error & { code?: string; traceId?: string }
    domainError.code = context?.error?.code
    domainError.traceId = context?.trace_id
    throw domainError
  }
  if (!data?.success) {
    const domainError = new Error(data?.error?.message || 'Yêu cầu không thành công') as Error & { code?: string; traceId?: string }
    domainError.code = data?.error?.code
    domainError.traceId = data?.trace_id
    throw domainError
  }
  return data.data as TOutput
}
