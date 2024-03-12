// Define all the island web components here.

import { hydrationTracker } from '@internal/fast-element'

import './app-shell.js'
import './app-item.js'
import './app-header.js'
import './app-button.js'

const po = new PerformanceObserver((entryList) => {
  for (const entry of entryList.getEntriesByName('first-paint')) {
    console.log(`FP: ${entry.startTime.toFixed(2)}ms`)
  }

  for (const entry of entryList.getEntriesByName('first-contentful-paint')) {
    console.log(`FCP: ${entry.startTime.toFixed(2)}ms`)
  }

  for (const entry of entryList.getEntriesByType('largest-contentful-paint')) {
    console.log(`LCP: ${entry.startTime.toFixed(2)}ms`)

    const duration = hydrationTracker.reduce((acc, current) => {
      if (current.endTime === 0) {
        return acc
      }
      return acc + (current.endTime - current.startTime)
    }, 0)
    console.log(`Hydrated: ${duration.toFixed(2)}ms`)
  }
})
po.observe({ type: 'paint', buffered: true })
po.observe({ type: 'largest-contentful-paint', buffered: true })
