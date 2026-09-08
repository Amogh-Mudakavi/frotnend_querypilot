import { WorkspaceShell } from '@/components/workspace-shell'

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  const id = Number(workspaceId)

  if (!Number.isInteger(id) || id <= 0) {
    return <div className="p-8 text-sm text-red-600">Invalid workspace.</div>
  }

  return <WorkspaceShell workspaceId={id}>{children}</WorkspaceShell>
}
