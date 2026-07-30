import { USER_ID } from '../config.js'
import { apiPostForm } from './client.js'

export async function extractImages(files, patientId) {
  const form = new FormData()
  form.append('user_id', USER_ID)
  for (const file of files) {
    form.append('files', file)
  }
  if (patientId) {
    form.append('patient_id', patientId)
  }
  return apiPostForm('/extract', form)
}
