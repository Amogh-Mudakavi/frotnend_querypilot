import { redirect } from 'next/navigation'

export default async function WorkspaceRootPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>
  searchParams: Promise<{ new?: string | string[] }>
}) {
  const { workspaceId } = await params
  const { new: isNew } = await searchParams
  const id = Number(workspaceId)

  if (!Number.isInteger(id) || id <= 0) {
    redirect('/workspaces')
  }

  const newQuery = Array.isArray(isNew) ? isNew[0] : isNew
  redirect(
    newQuery === '1'
      ? `/workspaces/${id}/chat?new=1`
      : `/workspaces/${id}/chat`,
  )
}
