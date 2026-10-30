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

  return <ChatCacheProvider workspaceId={id}>{children}</ChatCacheProvider>
}