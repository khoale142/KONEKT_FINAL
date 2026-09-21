import { Nav } from './components/Nav'
import { Hero } from './components/Hero'
import { FeaturesBento } from './components/FeaturesBento'
import { Footer } from './components/Footer'

function App() {
  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Nav />
      <main className="flex-1">
        <Hero />
        <FeaturesBento />
      </main>
      <Footer />
    </div>
  )
}

export default App
