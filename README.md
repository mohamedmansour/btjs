## About

### Node.js Independence

- Unlike SSR, which relies on Node.js for server-side rendering, BTJS breaks free from this dependency. No Node.js is required, simplifying deployment and reducing runtime overhead.
- BTJS is language agnostic, and simple protocol. We have built a Rust, and Node.js BTJS servers.

### CSS and HTML Separation

- BTJS takes a bold step by decoupling CSS and HTML from JavaScript. In SSR, these often end up bundled together, leading to larger payloads.
- With BTJS, CSS remains in its own realm, and HTML is no longer entangled within JavaScript files. This separation promotes cleaner code and easier maintenance.
- The Dev doesn't still programs in CSR , but the build-step will make it SSR (BTJS)

### Islands: The New Paradigm

- BTJS introduces the concept of Islands, self-contained functional units. .
- Islands are like mini-applications, isolated from one another as Web Components. They can be developed independently, promoting modularity and reusability.

### BTJS Element for Island Creation

- BTJS leverages BTJS Web Component Element, a lightweight library (2KB) for building web components. Developers can create Islands using BTJS Element’s declarative syntax. (`f-when`, `f-repeat`, `f-ref`, `f-on`), and each Web Component data binds to it via `@attr`, `@observable`.
- By treating JavaScript as a collection of Islands, we achieve a more efficient architecture.

### Faster First Contentful Paint (FCP/LCP)

- The magic of BTJS lies in its ability to shift work away from the browser and into the build step. This means that JavaScript execution is not required for FCP/LCP at all.
- Users experience fasterr load times, as critical rendering tasks are handled during build time.
- JavaScript will no longer contain templates or styles, just logic for making it interactive.

### SEO-Friendly Static Generation

- BTJS statically generates Islands, resulting in clean, SEO-friendly HTML.
- SSR often generates content dynamically, which can hinder SEO efforts.

### Server-Side Streaming with Precision

- BTJS enables server-side streaming, but with a twist. Each chunk of content is meticulously crafted to meet streaming requirements.
- Progressive rendering ensures a smooth user experience, even on slower connections.

## Declarative Bindings

We introduce three declarative bindings to facilitate the BTJS process in generating streamable chunks. These bindings adhere to the dot notation, thereby supporting any JSON/Object notations.

### f-signal

The `f-signal` binding serves as a wrapper around a value, capable of alerting relevant consumers when the value undergoes a change.

```html
<div f-signal=”name”>Default Name</div>
```

In this example, the `name` class variable within the Web Component is assigned the value "Default Name". Any mutation to `this.name` triggers an update in the corresponding DOM element.

### f-when

The `f-when` binding is a conditional element that can toggle between true and false states.

```html
<span f-when=”active”>Active</span>
```

In this instance, the `active` class variable within the Web Component is set to `true`. If the user alters this to `false`, the associated element ceases to be displayed.

### f-repeat

The `f-repeat` binding represents an array of templates.

```html
<div f-repeat=”users” w-component=”name-item”>
  <name-item>Red</name-item>
  <name-item>Blue</name-item>
  <name-item>Orange</name-item>
  <name-item>Yellow</name-item>
</div>
<template id=”name-item”>
  <slot></slot>
</template>
```

In this scenario, the `users` class variable within the Web Component is assigned a list of names, mirroring its current children. Similar to the other bindings, any mutation in this list prompts a corresponding mutation in the DOM.

### f-ref

The `f-ref` represents a reference to that DOM element.

```html
<canvas f-ref="drawingCanvas"></canvas>
```

The Web Component will have a private member named `drawingCanvas` with type `HTMLCanvasElement` to have a one way binding.

### f-on[eventName]

The `f-on` element, allows adding any event handler including custom events, the `eventName` is generic, such as `f-onclick`, `f-onkeyup`, etc

## BTJS Protocol and Server Handler

To facilitate server streaming and ensure compatibility with any language server, we require a protocol. The following definitions are provided for prototyping purposes.

```ts
interface BuildTimeRenderingStreamRepeat {
  type: 'repeat'
  value: string
  template: string
}

interface BuildTimeRenderingStreamRaw {
  type: 'raw'
  value: string
}

interface BuildTimeRenderingStreamSignal {
  type: 'signal'
  value: string
  defaultValue?: string
}

interface BuildTimeRenderingStreamWhen {
  type: 'when'
  value: string
}

type BuildTimeRenderingStream =
  | BuildTimeRenderingStreamRaw
  | BuildTimeRenderingStreamRepeat
  | BuildTimeRenderingStreamSignal
  | BuildTimeRenderingStreamWhen

interface BuildTimeRenderingTemplate {
  style: string
  template: string
}

type BuildTimeRenderingStreamTemplateRecords = Record<
  string,
  BuildTimeRenderingTemplate
>

interface BuildTimeRenderingProtocol {
  streams: BuildTimeRenderingStream[]
  templates: BuildTimeRenderingStreamTemplateRecords
}
```

The `BuildTimeRenderingProtocol` is an object generated by the BTJS process. It functions as an append-only data structure, with each item possessing a unique method of writing to the response buffer. Currently, we support three response types: `Signal`, `Raw`, and `Repeat`. These types dictate the rendering approach for each stream partial.

- `Signal`: This type streams a dynamic variable to the stream buffer.
- `Raw`: This type streams static text to the stream buffer.
- `Repeat`: This type streams a template to the buffer N times. Each item can possess its own unique template.
- `When`: This type streams a styling attribute to hide the dom.

## Development

### Pre-requisites

- Install rust https://rustup.rs/
- Install node v20 https://nodejs.org/en/download/
- Install pnpm https://pnpm.io/installation

### How to Build and Run

```sh
# Install the dependencies
pnpm install

# Builds the monorepo
pnpm build

# Runs the BTJS process on the @example/shadowdom-app
pnpm BTJS

# OR you can generate <link> instead of <style> transformations
pnpm BTJS --use-link-css

# Serves the website for @example/shadowdom-app
pnpm serve
```

### The components

#### The BTJS Build in TypeScript

- **packages/tools**: The BTJS Build process, that converts a single page application into a build time rendered application. Produces the protocol json file.
- **packages/eval-js**: The BTJS Expression Evaluator and Object query.
- **packages/parser-js**: The JavaScript Parser for the BTJS protocol. Used when streaming a request. Useful for Node/Bun/JS/Service Workers.
- **packages/protocol-js**: The TypeScript bindings for the protocol response.

#### The BTJS Parser in Rust

- **packages/parser-rust**: The Rust Parser for the BTJS protocol. Used when streaming a request. Useful for super fast run web severs.

#### The BTJS Hydration

- **packages/element**: We have developed a prototype for a compact web components framework. This framework hydrates the declarative bindings (`f-when`, `f-signal`, `f-repeat`) to its `@observable` within the Web Component. The entire framework is lightweight, with a total size of 3.4KB, which compresses down to just 1.7KB when gzipped.

#### The BTJS Example Application

- **apps/example-todo-app**: The TODO App using the FASTElement framework with BTJS Hints.
- **apps/example-counter-app**: The Counter App using the FASTElement framework with BTJS Hints.

#### The BTJS Server Implementations

- **packages/server-express**: The BTJS Server implemenation.
- **packages/server-rust**: The BTJS Rust implemenation.
