import { USER_ID } from '../config.js'
import { apiPostForm } from './client.js'

export async function generateSummary(patientId, extractionId, templateId) {
  const form = new FormData()
  form.append('user_id', USER_ID)
  form.append('patient_id', patientId)
  form.append('extraction_id', extractionId)
  form.append('template_id', templateId)
  return apiPostForm('/summarize', form)
}
