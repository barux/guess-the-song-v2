export function jsonp<T = unknown>(url: string, timeoutMs = 10000): Promise<T> {
	return new Promise((resolve, reject) => {
		const callbackName = `__jsonp_cb_${Math.random().toString(36).slice(2)}`
		const separator = url.includes('?') ? '&' : '?'
		const src = `${url}${separator}output=jsonp&callback=${callbackName}`
		const script = document.createElement('script')
		script.src = src

		let done = false
		const cleanup = () => {
			if ((window as any)[callbackName]) {
				try { delete (window as any)[callbackName] } catch {}
				;(window as any)[callbackName] = undefined
			}
			if (script.parentNode) {
				script.parentNode.removeChild(script)
			}
		}

		;(window as any)[callbackName] = (data: T) => {
			if (done) return
			done = true
			cleanup()
			resolve(data)
		}

		script.onerror = () => {
			if (done) return
			done = true
			cleanup()
			reject(new Error('JSONP request failed'))
		}

		const timer = setTimeout(() => {
			if (done) return
			done = true
			cleanup()
			reject(new Error('JSONP request timed out'))
		}, timeoutMs)

		script.onload = () => {
			// Some browsers call onload for JSONP; actual resolve happens via callback
			clearTimeout(timer)
		}

		document.head.appendChild(script)
	})
}


