import { ChatView } from '@/components/querypilot'

export default async function WorkspaceConversationPage({
  params,
}: {
  params: Promise<{ workspaceId: string; conversationId: string }>
}) {
  const { workspaceId, conversationId } = await params
  const workspaceNumericId = Number(workspaceId)
  const conversationNumericId = Number(conversationId)

  if (
    !Number.isInteger(workspaceNumericId) ||
    workspaceNumericId <= 0 ||
    !Number.isInteger(conversationNumericId) ||
    conversationNumericId <= 0
  ) {
    return <div className="p-8 text-sm text-red-600">Invalid conversation.</div>
  }

  return (
    <ChatView
      key={conversationNumericId}
      workspaceId={workspaceNumericId}
      conversationId={String(conversationNumericId)}
    />
  )
}
