/**
 * AnimatedBackground.jsx — Lively Animated Background Component
 * Adds particles, moving gradients, and visual flair to the app
 * 
 * Features:
 * - Floating particles with random movement
 * - Animated gradient orbs
 * - Smooth color transitions
 * - Performance optimized with CSS transforms
 */

import React, { useEffect, useState } from 'react';

function AnimatedBackground() {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    // Generate 30 random particles
    const newParticles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 20 + 15,
      delay: Math.random() * 5,
      xMove: Math.random() * 100 - 50,
      yMove: Math.random() * 100 - 50,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Animated Gradient Background */}
      <div
        className="absolute inset-0"
        style={{
          background: 'var(--surface)',
        }}
      />

      {/* Animated Orbs - Muted Pastels (Solid Colors Only) */}
      <div
        className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-10 blur-3xl"
        style={{
          background: '#B39CD0', /* Lavender */
          animation: 'floatSlow 20s ease-in-out infinite, pulse 8s ease-in-out infinite',
        }}
      />
      <div
        className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-8 blur-3xl"
        style={{
          background: '#A8DADC', /* Light cyan */
          animation: 'floatReverse 25s ease-in-out infinite, pulse 10s ease-in-out infinite',
        }}
      />
      <div
        className="absolute top-[40%] left-[50%] w-[400px] h-[400px] rounded-full opacity-6 blur-3xl"
        style={{
          background: '#FFC1CC', /* Soft pink */
          animation: 'floatSlow 15s ease-in-out infinite reverse, pulse 12s ease-in-out infinite',
        }}
      />

      {/* Floating Particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            opacity: 0.3,
            animation: `float ${particle.duration}s ease-in-out infinite`,
            animationDelay: `${particle.delay}s`,
            '--x-move': `${particle.xMove}px`,
            '--y-move': `${particle.yMove}px`,
          }}
        />
      ))}

      {/* Grid Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* CSS Animations */}
      <style>{`
        @keyframes floatSlow {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -30px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }

        @keyframes floatReverse {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(-40px, 30px) scale(0.9);
          }
          66% {
            transform: translate(30px, -20px) scale(1.1);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 0.05;
          }
          50% {
            opacity: 0.15;
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translate(0, 0);
          }
          50% {
            transform: translate(var(--x-move), var(--y-move));
          }
        }
      `}</style>
    </div>
  );
}

export default AnimatedBackground;
