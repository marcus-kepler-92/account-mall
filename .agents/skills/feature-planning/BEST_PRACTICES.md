# Feature Planning Best Practices Summary

This document summarizes the industry best practices incorporated into the feature-planning skill, based on 2025 software development standards.

## 1. Design Review Before Implementation

**Key Practice**: Conduct design reviews BEFORE coding begins, especially for complex features.

**Why**: Architectural decisions are cheapest to change at design time. Post-implementation changes are far more expensive.

**When to Use**:
- Features with unclear requirements
- Wide workload distribution estimates
- Unclear task decomposition
- Significant architectural impact

**Benefits**:
- Front-load decisions when changes are cheap
- Catch design issues early
- Align team on approach before implementation
- Reduce rework and technical debt

## 2. Prioritization Frameworks

### RICE Framework
**Formula**: (Reach × Impact × Confidence) / Effort

- **Reach**: How many users affected per quarter
- **Impact**: Per-user impact (0.25 minimal → 3 massive)
- **Confidence**: Estimate confidence (50% low → 100% high)
- **Effort**: Person-months of work

**Use Case**: Comparing multiple feature options objectively

### MoSCoW Method
- **Must have**: Critical for release
- **Should have**: Important but not critical
- **Could have**: Nice to have
- **Won't have**: Not in this cycle

**Use Case**: Capacity planning and stakeholder alignment

### Value vs Effort Matrix
Visual sorting into four quadrants:
- Quick wins (high value, low effort)
- Strategic initiatives (high value, high effort)
- Fill-ins (low value, low effort)
- Questionable (low value, high effort)

## 3. Feature Flags for Gradual Rollout

**Best Practices**:
- Clear naming conventions (e.g., `feature-new-checkout-flow`)
- Short-lived flags (remove after full rollout)
- Document purpose and rollout plan
- Implement access controls
- Test both enabled/disabled states
- Plan cleanup strategy

**Benefits**:
- Gradual rollout reduces risk
- Quick rollback capability
- A/B testing support
- Deploy without immediate activation
- Reduce customer downtime

## 4. Risk Assessment and Dependency Management

### Technical Risks to Consider
- Breaking changes to existing functionality
- Performance implications
- Integration complexity
- Database migration risks
- Third-party API limitations

### Business Risks
- User adoption concerns
- Data migration challenges
- Rollback complexity
- Feature flag dependencies

### Dependency Types
- **Upstream**: What must be completed first?
- **Downstream**: What features depend on this?
- **External**: Third-party services, APIs, infrastructure
- **Team**: Required expertise, availability

## 5. Cross-Functional Collaboration

**Principle**: Shared understanding, not serial handoffs

**Key Practices**:
- Product owners work alongside developers during development
- Developers participate in user research and understand business impact
- Designers embedded in all decisions beyond visual design
- Testers shift perspective through journey mapping

**Benefits**:
- Better solutions through shared understanding
- Faster decision-making
- Reduced miscommunication
- Everyone understands the "why"

## 6. Lightweight Requirements Documentation

**Agile Approach**:
- Requirements evolve iteratively (not fixed upfront)
- Lightweight documentation (not exhaustive)
- Shared ownership (not handoffs)
- Tools for discovery (not scope control)

**Documentation Techniques**:
- User stories: "As a [user type], I want [feature] so that [benefit]"
- Acceptance criteria: Specific, testable conditions
- Use cases: For complex features
- Visual models: Diagrams and flowcharts
- Continuous feedback: Regular customer input

## 7. Technical Debt Consideration

**Questions to Ask**:
- Will this feature introduce new technical debt?
- Are there existing refactorings that should happen first?
- Should this be done incrementally to avoid debt?
- Are there deprecated patterns to avoid?

**Strategy**: Balance speed with maintainability

## 8. Incremental Development

**Principle**: Break large features into smaller, manageable pieces

**Benefits**:
- Easier to test and validate
- Faster feedback loops
- Reduced risk
- More flexible to changes
- Better progress visibility

## 9. Value-Driven Prioritization

**Focus**: Business impact over technical complexity

**Consider**:
- What problem does this solve?
- Who benefits and how much?
- What's the opportunity cost?
- How does this align with business goals?

**Avoid**: Building features just because they're technically interesting

## 10. Monitoring and Observability

**Plan Early**:
- What metrics indicate success?
- What logs are needed for debugging?
- What alerts are required?
- How will we monitor performance?

**Include in Architecture**:
- Logging strategy
- Metrics collection
- Error tracking
- Performance monitoring
- User analytics (if applicable)

## Implementation Checklist

When planning a feature, ensure you've considered:

- [ ] Design review scheduled (for complex features)
- [ ] Prioritization framework applied (RICE/MoSCoW/Value-Effort)
- [ ] Risks identified and mitigation planned
- [ ] Dependencies mapped (upstream/downstream/external)
- [ ] Technical debt implications assessed
- [ ] Feature flag strategy defined (if needed)
- [ ] Monitoring and observability planned
- [ ] Incremental delivery approach defined
- [ ] Cross-functional collaboration approach established
- [ ] Lightweight documentation approach chosen

## References

- Microsoft Engineering Playbook: Design Reviews
- Atlassian Agile Requirements Documentation
- Thoughtworks Cross-Functional Collaboration Guide
- Feature Flag Best Practices (2025)
- Strategic Feature Prioritization Systems
