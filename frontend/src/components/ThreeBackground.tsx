'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface Particle extends THREE.Vector3 {
  velocity: THREE.Vector3;
}

export default function ThreeBackground() {
  const mountRef = useRef<HTMLDivElement>(null)
  const mouse = useRef(new THREE.Vector2(-1000, -1000))

  useEffect(() => {
    if (!mountRef.current) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mountRef.current.appendChild(renderer.domElement)

    // Particles
    const count = 600
    const particlesData: Particle[] = []
    const positions = new Float32Array(count * 3)
    
    for (let i = 0; i < count; i++) {
        const p = new THREE.Vector3(
            (Math.random() - 0.5) * 40,
            (Math.random() - 0.5) * 40,
            (Math.random() - 0.5) * 40
        ) as Particle
        p.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.005,
            (Math.random() - 0.5) * 0.005,
            (Math.random() - 0.5) * 0.005
        )
        particlesData.push(p)
        positions[i * 3] = p.x
        positions[i * 3 + 1] = p.y
        positions[i * 3 + 2] = p.z
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    
    const material = new THREE.PointsMaterial({
      color: 0x00ff88,
      size: 0.08,
      transparent: true,
      opacity: 0.2, // 15-25% as requested
      blending: THREE.AdditiveBlending
    })

    const points = new THREE.Points(geometry, material)
    scene.add(points)

    // Lines
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending
    })
    const linesGeometry = new THREE.BufferGeometry()
    const lineSegments = new THREE.LineSegments(linesGeometry, lineMaterial)
    scene.add(lineSegments)

    camera.position.z = 20

    const onMouseMove = (event: MouseEvent) => {
      mouse.current.x = (event.clientX / window.innerWidth) * 2 - 1
      mouse.current.y = -(event.clientY / window.innerHeight) * 2 + 1
    }
    window.addEventListener('mousemove', onMouseMove)

    const raycaster = new THREE.Raycaster()

    const animate = () => {
      requestAnimationFrame(animate)

      const positions = geometry.attributes.position.array as Float32Array
      const linePositions: number[] = []

      // Mouse repel logic
      raycaster.setFromCamera(mouse.current, camera)
      const mouseWorld = new THREE.Vector3()
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
      raycaster.ray.intersectPlane(plane, mouseWorld)

      for (let i = 0; i < count; i++) {
        const p = particlesData[i]
        
        // Drift
        p.add(p.velocity)

        // Mouse repulsion
        const distToMouse = p.distanceTo(mouseWorld)
        if (distToMouse < 4) { // Approximately 150px in world coords
            const repel = p.clone().sub(mouseWorld).normalize().multiplyScalar(0.02 * (1 - distToMouse / 4))
            p.add(repel)
        }

        // Boundary check
        if (p.x < -25 || p.x > 25) p.velocity.x *= -1
        if (p.y < -25 || p.y > 25) p.velocity.y *= -1
        if (p.z < -25 || p.z > 25) p.velocity.z *= -1

        positions[i * 3] = p.x
        positions[i * 3 + 1] = p.y
        positions[i * 3 + 2] = p.z

        // Lines
        for (let j = i + 1; j < count; j++) {
            const p2 = particlesData[j]
            const dist = p.distanceTo(p2)
            if (dist < 3) { // Approximately 120px
                linePositions.push(p.x, p.y, p.z, p2.x, p2.y, p2.z)
            }
        }
      }

      geometry.attributes.position.needsUpdate = true
      linesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))
      
      renderer.render(scene, camera)
    }

    animate()

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', handleResize)

    const mountNode = mountRef.current

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', onMouseMove)
      renderer.dispose()
      if (mountNode) mountNode.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div
      ref={mountRef}
      style={{
        position: 'fixed', top: 0, left: 0,
        width: '100%', height: '100%',
        zIndex: 0, pointerEvents: 'none',
        background: '#000000'
      }}
    />
  )
}

