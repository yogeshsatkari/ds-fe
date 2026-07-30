import { USER_ID } from '../config.js'
import { apiPostForm } from './client.js'

export async function uploadTemplate(file) {
  const form = new FormData()
  form.append('user_id', USER_ID)
  form.append('file', file)
  return apiPostForm('/templates', form)
}
