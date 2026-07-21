'use client';
import './globals.css'
import { Poppins } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Analytics } from '@vercel/analytics/react';
import Script from 'next/script'


const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-poppins'
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head />
      <ThemeProvider attribute='class' defaultTheme='light'>
        <body className={`${poppins.className} font-poppins bg-gray-100/50 dark:bg-grey-900 text-black dark:text-white overflow-x-hidden`}>
          {/* <body className='bg-gray-100/50 dark:bg-grey-900 text-black dark:text-white overflow-x-hidden'> */}
          {children}
          <Analytics />
          {/* ── AI Chatbot Widget ─────────────────────────────────────── */}
          <Script
            src="https://chatbot.flowcrafted.me/widget/widget.js"
            strategy="afterInteractive"
            data-api-url="https://chatbot.flowcrafted.me"
            data-theme="dark"
            data-position="bottom-right"
            data-accent="#7c3aed"
            data-greeting="Hi! I'm Mash 👋 Ask me anything about Mashookh's work, projects, or how to get in touch."
          />
        </body>
      </ThemeProvider>
    </html>
  )
}
