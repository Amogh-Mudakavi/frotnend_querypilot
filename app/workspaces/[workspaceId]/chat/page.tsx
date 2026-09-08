import { ChatView } from '@/components/querypilot'

export default async function WorkspaceDraftChatPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  const id = Number(workspaceId)

  if (!Number.isInteger(id) || id <= 0) {
    return <div className="p-8 text-sm text-red-600">Invalid workspace.</div>
  }

  return <ChatView workspaceId={id} />
}
