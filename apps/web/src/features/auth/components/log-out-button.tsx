import { Button } from '@web/components/actions/button'
import { useLogOut } from '@web/features/auth/api/use-log-out'
import { authMessages } from '@web/features/auth/auth.messages'

export function LogOutButton() {
  const logOut = useLogOut()
  return (
    <Button variant="tertiary" isLoading={logOut.isPending} onClick={() => logOut.mutate()}>
      {authMessages.logOut}
    </Button>
  )
}
