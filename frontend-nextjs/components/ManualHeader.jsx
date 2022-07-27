import { useMoralis } from 'react-moralis'

export default function ManualHeader() {

  const {enableWeb3} = useMoralis()

  return (
    <div>
      <button onClick={ () => {await enableWeb3()}}>Connect</button>
    </div>
  )
}
