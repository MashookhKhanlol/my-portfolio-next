import { FaNodeJs } from "react-icons/fa"
import HomePage from "./HomePage"

async function getData() {
  const DATA_URL = process.env.NEXT_PUBLIC_DATA_URL

  // Fallback to local data.json for development (when env var is not set)
  if (!DATA_URL) {
    const localData = await import('@/data.json')
    return localData.default
  }

  const res = await fetch(DATA_URL, { cache: 'no-store' })

  if (!res.ok) {
    throw new Error(`Failed to fetch data: ${res.status} ${res.statusText}`)
  }

  return res.json()
}

export default async function page() {

  const data = await getData()

  return (
    <>
      {data ?
        <HomePage data={data} />
        :
        <div className='h-screen w-screen flex flex-col items-center justify-center gap-5 text-violet-600 fixed z-30 bg-gray-100 dark:bg-grey-900'>
          <FaNodeJs size={100} className='animate-pulse' />
          <p className='animate-pulse text-xl'>Loading...</p>
        </div>
      }
    </>
  )
}