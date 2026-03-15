let audioContext = null

function getAudioContext() {
  if (typeof window === 'undefined') {
    return null
  }

  const AudioContextClass = window.AudioContext || window['webkitAudioContext']
  if (!AudioContextClass) {
    return null
  }

  if (!audioContext) {
    audioContext = new AudioContextClass()
  }

  return audioContext
}

function withAudioContext(callback) {
  try {
    const context = getAudioContext()
    if (!context) {
      return
    }

    if (context.state === 'suspended') {
      context.resume()
    }

    callback(context)
  } catch {
    // Ignore optional audio playback errors.
  }
}

function scheduleTone(context, { type = 'triangle', startFrequency, endFrequency, startTime, duration, peakGain }) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const stopTime = startTime + duration

  oscillator.type = type
  oscillator.frequency.setValueAtTime(startFrequency, startTime)
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(0.0001, endFrequency), stopTime)

  gain.gain.setValueAtTime(0.0001, startTime)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peakGain), startTime + Math.min(duration * 0.25, 0.05))
  gain.gain.exponentialRampToValueAtTime(0.0001, stopTime)

  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(startTime)
  oscillator.stop(stopTime + 0.01)
}

export function playMenuClickSound() {
  withAudioContext((context) => {
    const now = context.currentTime
    scheduleTone(context, {
      type: 'triangle',
      startFrequency: 480,
      endFrequency: 730,
      startTime: now,
      duration: 0.1,
      peakGain: 0.07,
    })
  })
}

export function playCorrectSound() {
  withAudioContext((context) => {
    const now = context.currentTime
    scheduleTone(context, {
      type: 'triangle',
      startFrequency: 620,
      endFrequency: 980,
      startTime: now,
      duration: 0.16,
      peakGain: 0.12,
    })
    scheduleTone(context, {
      type: 'sine',
      startFrequency: 940,
      endFrequency: 1280,
      startTime: now + 0.08,
      duration: 0.15,
      peakGain: 0.09,
    })
  })
}

export function playWrongSound() {
  withAudioContext((context) => {
    const now = context.currentTime
    scheduleTone(context, {
      type: 'sawtooth',
      startFrequency: 290,
      endFrequency: 170,
      startTime: now,
      duration: 0.2,
      peakGain: 0.11,
    })
  })
}

export function playSectionSuccessSound() {
  withAudioContext((context) => {
    const now = context.currentTime
    scheduleTone(context, {
      type: 'triangle',
      startFrequency: 520,
      endFrequency: 780,
      startTime: now,
      duration: 0.18,
      peakGain: 0.1,
    })
    scheduleTone(context, {
      type: 'triangle',
      startFrequency: 780,
      endFrequency: 1170,
      startTime: now + 0.14,
      duration: 0.2,
      peakGain: 0.1,
    })
  })
}

export function playSectionFailSound() {
  withAudioContext((context) => {
    const now = context.currentTime
    scheduleTone(context, {
      type: 'square',
      startFrequency: 260,
      endFrequency: 190,
      startTime: now,
      duration: 0.18,
      peakGain: 0.1,
    })
    scheduleTone(context, {
      type: 'square',
      startFrequency: 210,
      endFrequency: 130,
      startTime: now + 0.14,
      duration: 0.18,
      peakGain: 0.09,
    })
  })
}
