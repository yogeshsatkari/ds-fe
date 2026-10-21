export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://ds-x5ai.onrender.com'
export const USER_ID = import.meta.env.VITE_PLACEHOLDER_USER_ID ?? ''

export const FILE_ACCEPT = 'image/*,application/pdf,.pdf'
export const TEMPLATE_FILE_ACCEPT = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,.pdf,image/*'
export const MAX_FILES = 30
export const MAX_TOTAL_SIZE_MB = 50

export const USD_TO_INR_RATE = Number(import.meta.env.VITE_USD_TO_INR_RATE ?? 98)
