import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Taskify — Focus. Ship. Repeat.',
  description: 'A premium Notion-style task manager with Pomodoro focus sessions.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
