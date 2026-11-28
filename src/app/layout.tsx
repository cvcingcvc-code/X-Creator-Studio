import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'X-Creator-Studio · 独立创作者智能运营工作台',
  description: '长期个人知识库、多层原创性查重检测、真实联网雷达与批量图文创作工坊',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="min-h-screen bg-[#0b0f19] text-slate-100 antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
        {children}
      </body>
    </html>
  );
}
