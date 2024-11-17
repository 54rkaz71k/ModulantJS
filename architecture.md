# 🏗️ ModulantJS Architecture

## 🌐 System Overview

ModulantJS is a distributed client-side proxy tool that enables transparent request interception and routing through a hidden iframe mechanism. This document details its architecture, components, and use cases.

## 🔄 Core Components

```mermaid
graph TB
    subgraph "ModulantJS Core"
        A[Main Module] --> B[Hidden Iframe]
        A --> C[Route Manager]
        A --> D[Event Interceptor]
        
        B --> E[Message Handler]
        C --> F[Route Matcher]
        D --> G[Request Interceptor]
        D --> H[Navigation Interceptor]
    end

    subgraph "External Systems"
        I[Primary Server]
        J[Secondary Server]
        K[Browser APIs]
    end

    G --> I
    G --> J
    H --> K
    E --> G
```

### Component Details

#### 🎯 Main Module
- Initializes the framework
- Manages configuration
- Orchestrates component interactions

#### 🖼️ Hidden Iframe
- Acts as proxy layer
- Handles cross-origin requests
- Maintains isolated context

#### 🛣️ Route Manager
- Processes routing rules
- Matches requests to routes
- Determines request destinations

#### 🎭 Event Interceptor
- Captures browser events
- Intercepts navigation
- Handles user interactions

## 🔄 Request Flow

```mermaid
sequenceDiagram
    participant U as User
    participant M as ModulantJS
    participant I as Hidden Iframe
    participant P as Primary Server
    participant S as Secondary Server

    U->>M: Initiates Request
    M->>M: Check Route Rules
    alt Matches Secondary Route
        M->>I: Forward Request
        I->>S: Proxy Request
        S->>I: Response
        I->>M: Forward Response
        M->>U: Display Result
    else Primary Route
        M->>P: Direct Request
        P->>M: Response
        M->>U: Display Result
    end
```

## 🎯 Use Cases

### 1️⃣ API Request Interception

```mermaid
graph LR
    subgraph "Client Browser"
        A[Web Page] --> B[ModulantJS]
        B --> C[Hidden Iframe]
    end
    
    subgraph "Servers"
        D[Primary API]
        E[Secondary API]
    end
    
    C -->|Proxy Request| E
    B -->|Direct Request| D
```

#### Implementation Flow
1. Client makes API request
2. ModulantJS intercepts request
3. Route rules determine destination
4. Request proxied through iframe if needed
5. Response returned to client

### 2️⃣ Navigation Handling

```mermaid
stateDiagram-v2
    [*] --> NavigationEvent
    NavigationEvent --> RouteCheck
    RouteCheck --> ProxyNavigation: Secondary Route
    RouteCheck --> DirectNavigation: Primary Route
    ProxyNavigation --> UpdateHistory
    DirectNavigation --> UpdateHistory
    UpdateHistory --> [*]
```

#### Key Features
- Link click interception
- History API integration
- Transparent URL handling
- State preservation

### 3️⃣ Custom Script Injection

```mermaid
graph TB
    subgraph "ModulantJS Framework"
        A[Configuration] -->|Inject| B[Hidden Iframe]
        B -->|Execute| C[Custom Script]
        C -->|Event Handler| D[Message Bridge]
    end
    
    subgraph "Main Window"
        E[Event Listener]
        F[DOM Updates]
    end
    
    D -->|Post Message| E
    E -->|Trigger| F
```

## 🔒 Security Model

```mermaid
graph TB
    subgraph "Security Layers"
        A[Sandbox Restrictions] --> B[Origin Validation]
        B --> C[Message Verification]
        C --> D[Header Controls]
    end
    
    subgraph "Protection Mechanisms"
        E[CORS Bypass]
        F[Script Isolation]
        G[Domain Validation]
    end
    
    A --> E
    B --> F
    C --> G
```

### Security Features
- Iframe sandboxing
- Origin validation
- Message verification
- Header controls
- Script isolation

## 🔧 Configuration Structure

```mermaid
classDiagram
    class ModulantConfig {
        +String primaryServerURL
        +String secondaryServerURL
        +Array routes
        +Object defaultHeaders
        +String injectScript
    }
    
    class Route {
        +Object match
        +Object proxy
    }
    
    class Match {
        +String hostname
        +String path
    }
    
    class Proxy {
        +String target
        +String pathRewrite
    }
    
    ModulantConfig --> Route
    Route --> Match
    Route --> Proxy
```

## 🔄 State Management

```mermaid
stateDiagram-v2
    [*] --> Initialization
    Initialization --> Ready: Setup Complete
    Ready --> Processing: Request Received
    Processing --> Ready: Request Complete
    Processing --> Error: Request Failed
    Error --> Ready: Error Handled
    Ready --> [*]: Shutdown
```

### State Transitions
1. **Initialization**
   - Load configuration
   - Create iframe
   - Setup interceptors

2. **Ready**
   - Listen for events
   - Monitor navigation
   - Handle requests

3. **Processing**
   - Route requests
   - Proxy communication
   - Handle responses

4. **Error**
   - Catch exceptions
   - Log errors
   - Recover state

## 📊 Performance Considerations

```mermaid
graph LR
    A[Request] --> B{Cache Check}
    B -->|Hit| C[Return Cached]
    B -->|Miss| D[Process Request]
    D --> E{Route Type}
    E -->|Direct| F[Primary Server]
    E -->|Proxy| G[Secondary Server]
    F --> H[Response]
    G --> H
```

### Optimization Strategies
1. **Request Caching**
   - Cache responses
   - Reuse connections
   - Minimize overhead

2. **Resource Management**
   - Efficient routing
   - Connection pooling
   - Memory optimization

## 🔍 Debugging and Monitoring

```mermaid
graph TB
    subgraph "Debug Tools"
        A[Console Logging]
        B[Event Tracking]
        C[State Inspection]
    end
    
    subgraph "Monitoring"
        D[Performance Metrics]
        E[Error Tracking]
        F[Usage Analytics]
    end
    
    A --> D
    B --> E
    C --> F
```

### Debug Features
- Verbose logging
- Event tracking
- State inspection
- Performance monitoring
- Error reporting

## 🚀 Deployment Scenarios

```mermaid
graph TB
    subgraph "Development"
        A[Local Setup]
        B[Test Environment]
    end
    
    subgraph "Production"
        C[CDN Deployment]
        D[Edge Caching]
    end
    
    A --> B
    B --> C
    C --> D
```

### Deployment Options
1. **Development**
   - Local testing
   - Integration testing
   - Debug mode

2. **Production**
   - CDN distribution
   - Edge caching
   - Production mode
