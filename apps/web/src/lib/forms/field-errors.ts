import { formMessages } from '@web/lib/forms/forms.messages'
import type { FieldIssue, RequiredMessages } from '@web/lib/forms/forms.types'

const EMAIL_FORMAT = 'email'
const PATH_SEPARATOR = '.'

export function fieldErrorMap(requiredMessages: RequiredMessages) {
  return (issue: FieldIssue): string => {
    if (isEmpty(issue.input)) {
      return requiredMessages[pathOf(issue)] ?? formMessages.required
    }
    return messageFor(issue)
  }
}

function messageFor(issue: FieldIssue): string {
  if (issue.code === 'too_small' && typeof issue.minimum === 'number') {
    return formMessages.tooShort(issue.minimum)
  }
  if (issue.code === 'too_big' && typeof issue.maximum === 'number') {
    return formMessages.tooLong(issue.maximum)
  }
  if (issue.code === 'invalid_format' && issue.format === EMAIL_FORMAT) {
    return formMessages.email
  }
  return formMessages.invalid
}

function isEmpty(input: unknown): boolean {
  return input === undefined || input === null || (typeof input === 'string' && input.trim() === '')
}

function pathOf(issue: FieldIssue): string {
  return (issue.path ?? []).map(String).join(PATH_SEPARATOR)
}
