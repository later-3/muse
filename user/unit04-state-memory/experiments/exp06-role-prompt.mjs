/**
 * exp06 — 角色 Prompt 模板系统
 *
 * 巩固 Day 06: CrewAI Role/Task + Prompt 组装
 * - Role = { name, backstory, goal, constraints }
 * - Task 注入角色 prompt
 * - 支持组合多个角色能力
 */

function createRole(name, { backstory, goal, constraints = [], tools = [] } = {}) {
  return { name, backstory, goal, constraints, tools }
}

function buildSystemPrompt(role, { task, context } = {}) {
  const parts = [
    `# Role: ${role.name}`,
    role.backstory ? `\n## Background\n${role.backstory}` : '',
    role.goal ? `\n## Goal\n${role.goal}` : '',
    role.constraints.length ? `\n## Constraints\n${role.constraints.map(c => `- ${c}`).join('\n')}` : '',
    role.tools.length ? `\n## Available Tools\n${role.tools.map(t => `- ${t}`).join('\n')}` : '',
    task ? `\n## Current Task\n${task}` : '',
    context ? `\n## Context\n${context}` : '',
  ]
  return parts.filter(Boolean).join('\n')
}

function createTeam(roles) {
  return {
    roles,
    getRole(name) { return roles.find(r => r.name === name) },
    assignTask(roleName, task, context) {
      const role = this.getRole(roleName)
      if (!role) throw new Error(`Role "${roleName}" not found in team`)
      return buildSystemPrompt(role, { task, context })
    },
    listRoles() { return roles.map(r => ({ name: r.name, goal: r.goal })) },
  }
}

export { createRole, buildSystemPrompt, createTeam }
