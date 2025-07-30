import { BaseAgent, AgentCommand, AgentRegistry } from './base-agent';
import { AgentResult } from '../types';

export class DocumentationAgent extends BaseAgent {
  getAgentType(): string {
    return 'documentation';
  }

  getCapabilities(): string[] {
    return [
      'README generation and updates',
      'Code documentation (JSDoc, etc.)',
      'API documentation generation',
      'Component documentation',
      'Changelog generation',
      'Developer guide creation',
      'Architecture documentation',
      'Tutorial and example creation',
    ];
  }

  getSupportedCommands(): AgentCommand[] {
    return [
      {
        name: 'generate-readme',
        description: 'Create or update README file',
        parameters: [
          {
            name: 'sections',
            type: 'string[]',
            required: false,
            description: 'Specific sections to include',
          },
        ],
        examples: [
          'Generate comprehensive README',
          'Update README with new features',
          'Create README with installation and usage sections',
        ],
      },
      {
        name: 'document-code',
        description: 'Add code documentation and comments',
        parameters: [
          {
            name: 'target',
            type: 'string',
            required: false,
            description: 'Specific file or directory to document',
          },
        ],
        examples: [
          'Add JSDoc comments to all functions',
          'Document API endpoints in controllers/',
          'Add TypeScript type documentation',
        ],
      },
      {
        name: 'api-docs',
        description: 'Generate API documentation',
        examples: [
          'Generate API documentation from code',
          'Create OpenAPI/Swagger documentation',
          'Document REST API endpoints',
        ],
      },
      {
        name: 'component-docs',
        description: 'Document React/Vue components',
        examples: [
          'Document component props and usage',
          'Create component storybook documentation',
          'Generate component API reference',
        ],
      },
      {
        name: 'changelog',
        description: 'Generate or update changelog',
        examples: [
          'Generate changelog from git history',
          'Update CHANGELOG.md with recent changes',
          'Create release notes',
        ],
      },
      {
        name: 'dev-guide',
        description: 'Create developer documentation',
        examples: [
          'Create development setup guide',
          'Document project architecture',
          'Create contributing guidelines',
        ],
      },
    ];
  }

  validateCommand(command: string): { valid: boolean; error?: string } {
    const normalizedCommand = command.toLowerCase().trim();

    // Check for supported command patterns
    const supportedPatterns = [
      /^(generate|create|update).*readme/,
      /^document.*code/,
      /^(add|create).*doc/,
      /^api.*doc/,
      /^component.*doc/,
      /^changelog/,
      /^(dev|developer).*guide/,
      /^architecture.*doc/,
      /^contributing.*guide/,
      /^tutorial/,
      /^example/,
    ];

    const isSupported = supportedPatterns.some(pattern =>
      pattern.test(normalizedCommand)
    );

    if (!isSupported) {
      return {
        valid: false,
        error: `Unsupported command. Documentation Agent supports: README, code documentation, API docs, component docs, changelog, and developer guides.`,
      };
    }

    return { valid: true };
  }

  protected buildPrompt(command: string): string {
    const projectInfo = this.getProjectInfo();
    const commonInstructions = this.getCommonInstructions();
    const documentationContext = this.getDocumentationContext();

    let specificInstructions = '';
    const normalizedCommand = command.toLowerCase();

    if (normalizedCommand.includes('readme')) {
      specificInstructions = this.getReadmeInstructions(command);
    } else if (
      normalizedCommand.includes('code') ||
      normalizedCommand.includes('jsdoc')
    ) {
      specificInstructions = this.getCodeDocumentationInstructions(command);
    } else if (normalizedCommand.includes('api')) {
      specificInstructions = this.getApiDocumentationInstructions();
    } else if (normalizedCommand.includes('component')) {
      specificInstructions = this.getComponentDocumentationInstructions();
    } else if (normalizedCommand.includes('changelog')) {
      specificInstructions = this.getChangelogInstructions();
    } else if (
      normalizedCommand.includes('guide') ||
      normalizedCommand.includes('dev')
    ) {
      specificInstructions = this.getDeveloperGuideInstructions(command);
    } else {
      specificInstructions = this.getGeneralDocumentationInstructions(command);
    }

    return `
You are a Documentation Agent specialized in creating clear, comprehensive documentation for ${this.context.framework || 'software'} projects.

${projectInfo}

${documentationContext}

TASK: ${command}

${specificInstructions}

DOCUMENTATION PRINCIPLES:
- Write for your target audience (developers, users, contributors)
- Use clear, concise language
- Include practical examples and code snippets
- Keep documentation up-to-date with code changes
- Follow documentation best practices and conventions
- Make content scannable with headers and bullet points
- Include troubleshooting and FAQ sections where relevant

${commonInstructions}

Remember: Good documentation is as important as good code - it enables adoption and maintainability.
    `.trim();
  }

  private getDocumentationContext(): string {
    const hasReadme =
      this.context.structure?.files.some(f =>
        f.path.toLowerCase().includes('readme')
      ) || false;

    const docFiles =
      this.context.structure?.files.filter(
        f => f.path.includes('.md') || f.path.includes('docs/')
      ).length || 0;

    return `
DOCUMENTATION CONTEXT:
- Existing README: ${hasReadme ? 'Yes' : 'No'}
- Documentation Files: ${docFiles} found
- Framework: ${this.context.framework || 'Unknown'}
- Language: ${this.context.language || 'Unknown'}
- Project Type: ${this.getProjectType()}
    `.trim();
  }

  private getProjectType(): string {
    if (this.context.framework === 'Next.js') return 'Next.js Web Application';
    if (this.context.framework === 'React') return 'React Application/Library';
    if (this.context.framework === 'Vue.js') return 'Vue.js Application';
    if (this.context.framework === 'Angular') return 'Angular Application';

    const hasApi = this.context.structure?.files.some(
      f => f.path.includes('api/') || f.path.includes('routes/')
    );
    if (hasApi) return 'API/Backend Service';

    return 'Software Library/Application';
  }

  private getReadmeInstructions(command: string): string {
    const readmeTemplate = this.getReadmeTemplate();

    return `
README GENERATION/UPDATE INSTRUCTIONS:
1. Analyze project structure and purpose
2. Identify key features and functionality
3. Create comprehensive README following best practices
4. Include all essential sections
5. Add code examples and usage instructions

${readmeTemplate}

README CONTENT GUIDELINES:
- Start with a clear project description
- Include installation and setup instructions
- Provide usage examples with code snippets
- Document API if applicable
- Add contribution guidelines
- Include license information
- Add badges for build status, version, etc.
- Keep it concise but comprehensive

TECHNICAL REQUIREMENTS:
- Use proper Markdown formatting
- Include syntax highlighting for code blocks
- Add table of contents for long READMEs
- Use relative links for internal references
- Optimize for GitHub/GitLab rendering
- Include screenshots or diagrams if helpful
    `;
  }

  private getCodeDocumentationInstructions(command: string): string {
    const docStandards = this.getDocumentationStandards();

    return `
CODE DOCUMENTATION INSTRUCTIONS:
1. Analyze code structure and identify undocumented functions/classes
2. Add appropriate documentation comments
3. Follow language-specific documentation standards
4. Include parameter descriptions and return types
5. Add usage examples where helpful

${docStandards}

DOCUMENTATION TARGETS:
- Public functions and methods
- Class definitions and interfaces
- Complex algorithms or business logic
- Configuration options
- Error handling patterns
- Integration points and APIs

QUALITY GUIDELINES:
- Write clear, concise descriptions
- Document all parameters and return values
- Include usage examples for complex functions
- Explain the "why" not just the "what"
- Keep documentation synchronized with code
- Use consistent terminology throughout
    `;
  }

  private getApiDocumentationInstructions(): string {
    return `
API DOCUMENTATION INSTRUCTIONS:
1. Identify all API endpoints in the project
2. Document request/response formats
3. Include authentication requirements
4. Add usage examples and error responses
5. Generate comprehensive API reference

API DOCUMENTATION STRUCTURE:
- Endpoint overview and purpose
- HTTP method and URL pattern
- Request parameters and body schema
- Response format and status codes
- Authentication and authorization requirements
- Rate limiting information
- Error responses and codes
- Usage examples with curl/code samples

DOCUMENTATION FORMATS:
${this.getApiDocumentationFormats()}

INTEGRATION CONSIDERATIONS:
- Auto-generation from code annotations
- Interactive API explorer (Swagger UI)
- Postman collection export
- SDK generation compatibility
- Version management and backwards compatibility
    `;
  }

  private getComponentDocumentationInstructions(): string {
    const componentDocFormat = this.getComponentDocumentationFormat();

    return `
COMPONENT DOCUMENTATION INSTRUCTIONS:
1. Identify all components in the project
2. Document props, events, and slots
3. Create usage examples
4. Document component lifecycle and behavior
5. Generate component API reference

${componentDocFormat}

COMPONENT DOCUMENTATION AREAS:
- Component purpose and use cases
- Props/attributes with types and defaults
- Events emitted and their payloads
- Slots/children content expectations
- Styling and theming options
- Accessibility considerations
- Browser compatibility
- Performance characteristics

INTERACTIVE DOCUMENTATION:
- Storybook integration (if applicable)
- Live code examples
- Visual component gallery
- Interactive prop controls
- Responsive behavior examples
    `;
  }

  private getChangelogInstructions(): string {
    return `
CHANGELOG GENERATION INSTRUCTIONS:
1. Analyze git commit history since last documented version
2. Categorize changes by type (features, fixes, breaking changes)
3. Create user-friendly change descriptions
4. Follow Keep a Changelog format
5. Update version numbers and dates

CHANGELOG STRUCTURE:
- [Unreleased] - for upcoming changes
- [Version] - Date - for released versions
- Categories: Added, Changed, Deprecated, Removed, Fixed, Security

CHANGE CATEGORIZATION:
- Added: New features and functionality
- Changed: Changes in existing functionality
- Deprecated: Soon-to-be removed features
- Removed: Removed features
- Fixed: Bug fixes
- Security: Security-related changes

WRITING GUIDELINES:
- Write from user perspective
- Be specific about what changed
- Include migration notes for breaking changes
- Reference issue numbers where applicable
- Use consistent tense and formatting
- Group related changes together
    `;
  }

  private getDeveloperGuideInstructions(command: string): string {
    return `
DEVELOPER GUIDE INSTRUCTIONS:
1. Create comprehensive development documentation
2. Include setup and environment requirements
3. Document development workflow and processes
4. Add architectural overview and design decisions
5. Include contribution guidelines and standards

DEVELOPER GUIDE SECTIONS:
- Project overview and goals
- Development environment setup
- Architecture and design patterns
- Code organization and conventions
- Testing strategy and guidelines
- Build and deployment processes
- Contribution workflow
- Troubleshooting common issues

TECHNICAL DOCUMENTATION:
- System requirements and dependencies
- Configuration options and environment variables
- Database schema and migrations
- External service integrations
- Performance considerations
- Security best practices
- Monitoring and logging

PROCESS DOCUMENTATION:
- Git workflow and branching strategy
- Code review process
- Release and deployment procedures
- Issue tracking and bug reporting
- Communication channels and tools
    `;
  }

  private getGeneralDocumentationInstructions(command: string): string {
    return `
GENERAL DOCUMENTATION INSTRUCTIONS:
Based on the specific command, create appropriate documentation:
1. Identify the documentation target and audience
2. Choose the appropriate documentation format
3. Create clear, comprehensive content
4. Include relevant examples and references
5. Ensure consistency with existing documentation

Focus on clarity, accuracy, and usefulness for the intended audience.
    `;
  }

  private getReadmeTemplate(): string {
    return `
STANDARD README SECTIONS:
1. Project Title and Description
2. Badges (build status, version, license)
3. Table of Contents (for long READMEs)
4. Installation/Setup Instructions
5. Usage Examples
6. API Reference (if applicable)
7. Contributing Guidelines
8. License Information
9. Acknowledgments/Credits
10. Support/Contact Information

OPTIONAL SECTIONS:
- Screenshots or demos
- Roadmap and future plans
- FAQ and troubleshooting
- Performance benchmarks
- Related projects
- Changelog highlights
    `;
  }

  private getDocumentationStandards(): string {
    switch (this.context.language) {
      case 'typescript':
      case 'javascript':
        return `
JSDOC STANDARDS:
- Use /** */ comment blocks
- @param {type} name - description
- @returns {type} description
- @throws {type} description
- @example code example
- @see reference links
- @since version information
        `;
      case 'python':
        return `
PYTHON DOCSTRING STANDARDS:
- Use triple quotes for docstrings
- Follow Google or NumPy style
- Document parameters and return values
- Include usage examples
- Use type hints with documentation
        `;
      case 'java':
        return `
JAVADOC STANDARDS:
- Use /** */ comment blocks
- @param name description
- @return description
- @throws exception description
- @author author information
- @version version information
        `;
      default:
        return 'Follow language-specific documentation conventions and standards.';
    }
  }

  private getApiDocumentationFormats(): string {
    return `
SUPPORTED API DOCUMENTATION FORMATS:
- OpenAPI/Swagger specification
- Markdown-based documentation
- Postman collection format
- GraphQL schema documentation
- REST API documentation templates
    `;
  }

  private getComponentDocumentationFormat(): string {
    if (this.context.framework === 'React') {
      return `
REACT COMPONENT DOCUMENTATION:
- PropTypes or TypeScript interfaces
- Component description and purpose
- Usage examples with JSX
- Storybook stories (if applicable)
- Testing examples
- Styling and theming options
      `;
    }

    if (this.context.framework === 'Vue.js') {
      return `
VUE COMPONENT DOCUMENTATION:
- Props with types and validators
- Events and their payloads
- Slots and scoped slots
- Composition API usage
- Template examples
- Style bindings and CSS variables
      `;
    }

    return `
COMPONENT DOCUMENTATION FORMAT:
- Component interface and API
- Usage examples and patterns
- Configuration options
- Event handling
- Styling and customization
- Browser compatibility notes
    `;
  }

  protected async generateArtifacts(
    command: string,
    result: AgentResult
  ): Promise<Record<string, unknown>> {
    return {
      documentationType: this.determineDocumentationType(command),
      targetAudience: this.determineTargetAudience(command),
      projectLanguage: this.context.language,
      projectFramework: this.context.framework,
      documentationTimestamp: new Date().toISOString(),
      commandExecuted: command,
    };
  }

  private determineDocumentationType(command: string): string {
    const normalizedCommand = command.toLowerCase();

    if (normalizedCommand.includes('readme')) return 'readme';
    if (
      normalizedCommand.includes('code') ||
      normalizedCommand.includes('jsdoc')
    )
      return 'code-documentation';
    if (normalizedCommand.includes('api')) return 'api-documentation';
    if (normalizedCommand.includes('component'))
      return 'component-documentation';
    if (normalizedCommand.includes('changelog')) return 'changelog';
    if (
      normalizedCommand.includes('guide') ||
      normalizedCommand.includes('dev')
    )
      return 'developer-guide';
    if (normalizedCommand.includes('tutorial')) return 'tutorial';
    if (normalizedCommand.includes('architecture'))
      return 'architecture-documentation';

    return 'general-documentation';
  }

  private determineTargetAudience(command: string): string {
    const normalizedCommand = command.toLowerCase();

    if (normalizedCommand.includes('api')) return 'api-consumers';
    if (normalizedCommand.includes('component')) return 'component-users';
    if (
      normalizedCommand.includes('dev') ||
      normalizedCommand.includes('contributing')
    )
      return 'developers';
    if (
      normalizedCommand.includes('user') ||
      normalizedCommand.includes('readme')
    )
      return 'end-users';
    if (normalizedCommand.includes('tutorial')) return 'beginners';

    return 'general-audience';
  }
}

// Register the agent
AgentRegistry.register('documentation', DocumentationAgent);
