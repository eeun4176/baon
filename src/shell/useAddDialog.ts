/*
 * useAddDialog.ts — Opens/closes the Add dialog through the URL ("?add=1", "&edit=<id>")
 * so it can be opened from any page and the phone's Back button closes it.
 */
import { useLocation, useNavigate } from 'react-router'

/** Opens/closes the Add dialog through the URL so the phone's Back button closes it. */
export function useAddDialog() {
  const navigate = useNavigate()
  const location = useLocation()
  return {
    open: (editId?: string) => navigate({ search: editId ? `?add=1&edit=${editId}` : '?add=1' }, { state: { modal: true } }),
    close: () => (location.state?.modal ? navigate(-1) : navigate({ search: '' }, { replace: true })),
  }
}
