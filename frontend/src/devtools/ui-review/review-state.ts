export type ReviewMode = 'normal' | 'empty' | 'error' | 'slow'

export const reviewState: { mode: ReviewMode } = { mode: 'normal' }

export function setReviewMode(mode: ReviewMode) {
  reviewState.mode = mode
}
