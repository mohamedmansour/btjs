import './app-header.js'
import './app-item.js'
import './app-shell.js'

new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    console.log(entry.name, entry.duration, 'ms')
  })
}).observe({ type: 'measure', buffered: true })
new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    console.log(entry.name, entry.startTime, 'ms')
  })
}).observe({ type: 'paint', buffered: true })
