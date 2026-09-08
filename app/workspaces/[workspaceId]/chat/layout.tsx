import { ChatCacheProvider } from '@/components/chat-context'

export default async function ChatLayout({
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

  // This layout persists across /chat -> /chat/:id -> /chat/:otherId
  // navigations (Next.js only swaps the leaf page segment), so the
  // ChatCacheProvider mounted here is never torn down by conversation
  // switches or by the draft -> persisted-conversation URL promotion.
  return <ChatCacheProvider workspaceId={id}>{children}</ChatCacheProvider>
}
