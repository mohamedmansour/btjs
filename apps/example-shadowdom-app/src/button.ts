class AppButton extends HTMLElement {
  static get observedAttributes() {
    return ['appearance']
  }

  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === 'appearance') {
      this.updateStyle(newValue)
    }
  }

  updateStyle(appearance: string) {
    const button = this.shadowRoot!.querySelector('button')
    if (button) {
      button.className = appearance
    }
  }

  connectedCallback() {
    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          --background-color: #007bff;
          --text-color: #ffffff;
          --border-color: transparent;
        }

        @media (prefers-color-scheme: dark) {
          :host {
            --background-color: #0066cc;
            --text-color: #ffffff;
            --border-color: transparent;
          }
        }

        button {
          background-color: var(--background-color);
          color: var(--text-color);
          border: 2px solid var(--border-color);
          padding: 10px 20px;
          text-align: center;
          text-decoration: none;
          display: inline-block;
          font-size: 16px;
          margin: 4px 2px;
          cursor: pointer;
        }

        button.secondary {
          background-color: transparent;
          outline: 1px solid var(--text-color);
        }
      </style>
      <button><slot></slot></button>
    `

    this.updateStyle(this.getAttribute('appearance') || '')
  }
}

customElements.define('app-button', AppButton)
