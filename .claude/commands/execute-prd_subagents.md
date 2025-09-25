# Execute PRD with Specialized Agent Distribution

Implement a feature using the PRD file, distributing work among specialized agents based on their expertise.

## PRD File: $ARGUMENTS

## Execution Process with Agent Orchestration

1. **Load PRD & Analyze Agent Requirements**
   - Read the specified PRD file
   - Understand all context and requirements
   - Identify which specialized agents are needed based on feature type
   - Map tasks to appropriate agent specialties
   - Ensure you have all needed context to implement the PRD fully
   - Do more web searches and codebase exploration as needed

2. **ULTRATHINK & Agent Planning**
   - Think hard before you execute the plan. Create a comprehensive plan addressing all requirements.
   - Break down complex tasks into agent-specific assignments:
     * Frontend tasks → `component-architect`, `tailwind-frontend-expert`, `ux-designer`
     * Backend tasks → `api-integration-specialist`, `general-purpose`
     * Database tasks → `database-architect`
     * Payment tasks → `payment-systems-specialist`
     * Real-time tasks → `realtime-systems-architect`
     * Gamification → `gamification-designer`
     * Performance → `performance-optimizer`
     * Scheduled jobs → `job-scheduler`
     * Security review → `security-reviewer`
     * Test strategy → `test-strategy-architect`
   - Use the TodoWrite tool to create and track your implementation plan with agent assignments
   - Identify implementation patterns from existing code to follow

3. **Execute with Agent Distribution**
   - Deploy specialized agents for their respective domains:
     
   **Frontend Implementation:**
   - Use `component-architect` for React component structure and state management
   - Deploy `tailwind-frontend-expert` for styling and responsive design
   - Engage `ux-designer` for user flow optimization
   
   **Backend Implementation:**
   - Use `api-integration-specialist` for external service integrations
   - Deploy `database-architect` for schema changes and queries
   - Engage `payment-systems-specialist` for Stripe-related code
   - Use `realtime-systems-architect` for Socket.io features
   - Deploy `job-scheduler` for Bull Queue tasks
   
   **Quality & Security:**
   - Use `test-strategy-architect` to design comprehensive tests
   - Deploy `security-reviewer` to audit implementation
   - Engage `performance-optimizer` for optimization opportunities

4. **Validate with Specialized Agents**
   - Run each validation command
   - Use `test-strategy-architect` to ensure test coverage
   - Deploy `security-reviewer` for security validation
   - Use `performance-optimizer` to check performance metrics
   - Fix any failures with appropriate agent expertise
   - Re-run until all pass

5. **Complete with Final Review**
   - Ensure all checklist items done
   - Run final validation suite
   - Have `security-reviewer` do final security check
   - Have `test-strategy-architect` verify test coverage
   - Report completion status with agent performance metrics
   - Read the PRD again to ensure you have implemented everything

6. **Reference the PRD**
   - You can always reference the PRD again if needed
   - Consult specialized agents for domain-specific questions

7. **Agent Coordination Best Practices**
   - **Parallel Execution**: Deploy multiple agents concurrently when tasks are independent
   - **Sequential Execution**: Chain agents when output from one is input to another
   - **Cross-Domain Review**: Have agents review each other's work (e.g., security-reviewer checks payment-systems-specialist's work)
   - **Iterative Refinement**: Use agents iteratively to refine implementation based on validation results

## Agent Task Examples

### For a New Feature with UI, API, and Database:
1. `database-architect`: Design schema and migrations
2. `api-integration-specialist`: Create API endpoints
3. `component-architect`: Design React components
4. `tailwind-frontend-expert`: Implement responsive UI
5. `test-strategy-architect`: Create test suite
6. `security-reviewer`: Final security audit

### For Payment Integration:
1. `payment-systems-specialist`: Implement Stripe integration
2. `database-architect`: Design payment tables
3. `security-reviewer`: Audit payment flow
4. `test-strategy-architect`: Design payment tests

### For Real-time Features:
1. `realtime-systems-architect`: Design Socket.io implementation
2. `component-architect`: Create real-time UI components
3. `performance-optimizer`: Optimize WebSocket connections
4. `test-strategy-architect`: Design real-time tests

Note: If validation fails, use appropriate specialized agent to diagnose and fix based on their domain expertise.