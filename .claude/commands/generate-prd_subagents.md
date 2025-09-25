# Create PRD with Specialized Agent Distribution

## Feature file: $ARGUMENTS

Generate a complete PRD for general feature implementation with thorough research, leveraging specialized agents for domain expertise. Ensure context is passed to the AI agents to enable self-validation and iterative refinement. Read the feature file first to understand what needs to be created, how the examples provided help, and any other considerations.

The AI agents only get the context you are appending to the PRD and training data. Assume the AI agents have access to the codebase and the same knowledge cutoff as you, so its important that your research findings are included or referenced in the PRD. The Agents have Websearch capabilities, so pass urls to documentation and examples.

## Research Process with Agent Distribution

1. **Codebase Analysis**
   - Search for similar features/patterns in the codebase
   - Identify files to reference in PRD
   - Note existing conventions to follow
   - Check test patterns for validation approach
   
   **Agent Delegation for Codebase Analysis:**
   - Use `general-purpose` agent for broad codebase exploration
   - Deploy `database-architect` for schema and data model research
   - Engage `component-architect` for React component patterns
   - Use `api-integration-specialist` for third-party service patterns
   - Check test patterns with `test-strategy-architect`

2. **External Research**
   - Search for similar features/patterns online
   - Library documentation (include specific URLs)
   - Implementation examples (GitHub/StackOverflow/blogs)
   - Best practices and common pitfalls
   
   **Agent Delegation for Feature-Specific Research:**
   - **UI/UX Features**: Use `ux-designer` for flow analysis and `tailwind-frontend-expert` for implementation patterns
   - **Payment Features**: Deploy `payment-systems-specialist` for Stripe patterns and compliance
   - **Real-time Features**: Use `realtime-systems-architect` for Socket.io patterns
   - **Gamification**: Engage `gamification-designer` for badge/leaderboard mechanics
   - **Performance**: Use `performance-optimizer` for optimization strategies
   - **Scheduled Tasks**: Deploy `job-scheduler` for cron/Bull Queue patterns

3. **User Clarification** (if needed)
   - Specific patterns to mirror and where to find them?
   - Integration requirements and where to find them?
   
   **Security & Architecture Review Agents:**
   - Use `security-reviewer` to assess security implications
   - Deploy `database-architect` for data model validation
   - Engage `component-architect` for frontend architecture review

## PRD Generation with Agent Task Assignment

Using PRDs/templates/PRD_base.md as template:

### Critical Context to Include and pass to the AI agents
- **Documentation**: URLs with specific sections for relevant agents
- **Code Examples**: Real snippets from codebase with agent assignments
- **Gotchas**: Library quirks, version issues per domain
- **Patterns**: Existing approaches with specialized agent guidance

### Implementation Blueprint with Agent Distribution
- Start with pseudocode showing approach
- Reference real files for patterns
- Include error handling strategy
- **Task Assignment by Agent Specialty**:
  - Frontend UI tasks → `component-architect`, `tailwind-frontend-expert`
  - Database/schema tasks → `database-architect`
  - API integrations → `api-integration-specialist`
  - Payment processing → `payment-systems-specialist`
  - Real-time features → `realtime-systems-architect`
  - Gamification logic → `gamification-designer`
  - Performance tasks → `performance-optimizer`
  - Scheduled jobs → `job-scheduler`
  - Security review → `security-reviewer`
  - Test planning → `test-strategy-architect`
  - UX optimization → `ux-designer`

### Validation Gates (Must be Executable)
```bash
# Frontend Validation (React/TypeScript)
npm run lint
npm run typecheck
npm run test

# Backend Validation (Node.js/Express)
cd server && npm run lint
cd server && npm run typecheck
cd server && npm run test

# Database Validation
npx prisma validate
npx prisma migrate deploy --dry-run

# Security Validation
npm audit
```

*** CRITICAL AFTER YOU ARE DONE RESEARCHING AND EXPLORING THE CODEBASE BEFORE YOU START WRITING THE PRD ***

*** ULTRATHINK ABOUT THE PRD AND PLAN YOUR APPROACH THEN START WRITING THE PRD ***

## Output
Save as: `PRDs/{feature-name}.md`

## Quality Checklist with Agent Coverage
- [ ] All necessary context included for each specialized agent
- [ ] Validation gates are executable by AI agents
- [ ] References existing patterns with agent assignments
- [ ] Clear implementation path with agent task distribution
- [ ] Error handling documented per domain
- [ ] Agent specialties properly mapped to tasks:
  - [ ] UI/Frontend → `component-architect`, `tailwind-frontend-expert`, `ux-designer`
  - [ ] Backend/API → `api-integration-specialist`, `general-purpose`
  - [ ] Database → `database-architect`
  - [ ] Payments → `payment-systems-specialist`
  - [ ] Real-time → `realtime-systems-architect`
  - [ ] Gamification → `gamification-designer`
  - [ ] Performance → `performance-optimizer`
  - [ ] Jobs/Cron → `job-scheduler`
  - [ ] Security → `security-reviewer`
  - [ ] Testing → `test-strategy-architect`

Score the PRD on a scale of 1-10 (confidence level to succeed in one-pass implementation using specialized agents)

Remember: The goal is one-pass implementation success through comprehensive context and proper agent delegation.