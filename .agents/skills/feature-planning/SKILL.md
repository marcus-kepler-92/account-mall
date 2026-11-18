---
name: feature-planning
description: Plan feature implementation by analyzing codebase context, exploring available tools, clarifying requirements, and generating role-based todo lists (product manager, architect, senior developer, tester). Use when starting a new feature implementation, refactoring, or when the user asks to plan a feature.
---

# Feature Planning Workflow

Plan features systematically: understand context, clarify requirements, then generate role-based todos.

## Workflow

1. **Discovery**: Explore codebase and available tools
2. **Requirements**: Clarify what needs to be built
3. **Plan**: Generate role-based todo lists

---

## Phase 1: Discovery

Before planning, understand what you're working with:

### Explore Codebase
- Read `README.md`, `TASKS.md`, `package.json`
- Understand tech stack and existing patterns
- Search for similar features: "How is X implemented?", "Where is Y pattern used?"

### Identify Tools
- Codebase: `codebase_search`, `grep`, `read_file`
- Editing: `search_replace`, `write`
- Planning: `todo_write` (plan mode)
- Others: `run_terminal_cmd`, `read_lints`, `web_search`

---

## Phase 2: Requirements

Document clearly:

- **What**: Feature/functionality to build
- **Why**: Problem it solves, business value
- **Who**: Target users
- **Where**: Affected codebase areas
- **Constraints**: Technical, business, security, performance
- **Acceptance Criteria**: Specific, testable "done" conditions

### Quick Prioritization
- High value + low effort = Quick win
- High value + high effort = Strategic
- Consider dependencies and risks

---

## Phase 3: Generate Role-Based Todos

Use `todo_write` with `merge=false` to create separate lists for each role.

### Product Manager
Focus: Requirements, UX, business logic

- Define user stories: "As a [user], I want [feature] so that [benefit]"
- Write acceptance criteria
- Specify UI/UX requirements
- Define business rules and validations
- Identify edge cases

**Example:**
```markdown
- [ ] User story: "As a customer, I want email confirmation so I have order backup"
- [ ] Acceptance: Email sent within 5s of order completion
- [ ] Define validation rules and error messages
- [ ] Review user flows for consistency
```

### Architect
Focus: System design, integration, scalability

- Design API endpoints and schemas
- Plan database changes (with rollback)
- Design integration points
- Consider performance and error handling
- Plan monitoring/logging

**Example:**
```markdown
- [ ] Design API: POST /api/feature/action
- [ ] Define Zod schemas for request/response
- [ ] Plan database migration with rollback
- [ ] Design transaction boundaries
- [ ] Plan error handling strategy
```

### Senior Developer
Focus: Implementation, code structure

- Implement API routes following patterns
- Create/update database models
- Write business logic and validations
- Create components
- Add TypeScript types
- Write unit tests

**Example:**
```markdown
- [ ] Create API route: app/api/feature/route.ts
- [ ] Implement Zod validation schema
- [ ] Write business logic: lib/feature.ts
- [ ] Create component: app/components/feature-form.tsx
- [ ] Add types: types/feature.ts
- [ ] Write tests: __tests__/feature.test.ts
```

### Tester
Focus: Test coverage, quality assurance

- Unit tests for business logic
- Integration tests for API routes
- Test UI components
- Test error scenarios and edge cases
- Test auth/authorization

**Example:**
```markdown
- [ ] Unit test: validateFeatureInput() handles invalid input
- [ ] Integration test: POST /api/feature returns 201 on success
- [ ] Integration test: Returns 400 on validation error
- [ ] Test: Error messages display correctly
- [ ] Test: Unauthorized access blocked
```

---

## Key Principles

1. **Context First**: Understand codebase before planning
2. **Be Specific**: Todos should be actionable with file paths/function names
3. **Follow Patterns**: Match existing codebase conventions
4. **Consider Dependencies**: Order todos to respect dependencies
5. **Think Holistically**: Consider system-wide impact

---

## Remember

- Start with discovery - don't plan in a vacuum
- Use semantic search to find related code
- Reference existing patterns
- Keep todos actionable and specific
- Think about testing from the start
