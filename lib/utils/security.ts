import path from 'path';
import { exec } from 'child_process';

/**
 * Validates and normalizes file paths to prevent directory traversal attacks
 * @param basePath The base directory path
 * @param userPath The user-provided path
 * @returns The normalized safe path or null if validation fails
 */
export function validatePath(basePath: string, userPath: string): string | null {
  try {
    // Normalize both paths
    const normalizedBase = path.resolve(basePath);
    const normalizedUserPath = path.resolve(basePath, userPath);
    
    // Check if the resolved path is within the base directory
    if (!normalizedUserPath.startsWith(normalizedBase)) {
      return null;
    }
    
    // Additional checks for common traversal patterns
    if (userPath.includes('~')) {
      // Reject tilde expansion attempts
      return null;
    }
    
    return normalizedUserPath;
  } catch (error) {
    return null;
  }
}

/**
 * Sanitizes input for use in shell commands
 * @param input The user input to sanitize
 * @returns Sanitized input safe for shell execution
 */
export function sanitizeShellInput(input: string): string {
  // Remove or escape potentially dangerous characters
  // This is a basic implementation - consider using a library like shell-escape
  return input
    .replace(/[`$(){}[\]|;&<>!\\'"]/g, '') // Remove dangerous characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Validates Git branch names to prevent command injection
 * @param branchName The branch name to validate
 * @returns true if valid, false otherwise
 */
export function validateGitBranchName(branchName: string): boolean {
  // Git branch name rules:
  // - Cannot start with a dot (.)
  // - Cannot contain two consecutive dots (..)
  // - Cannot contain characters: ~ ^ : ? * [ \ space
  // - Cannot end with a slash (/)
  // - Cannot end with .lock
  
  const invalidPatterns = [
    /^\./,                    // Starts with dot
    /\.\./,                   // Contains two dots
    /[~^:?*[\]\\]/,          // Invalid characters
    /\s/,                     // Contains whitespace
    /\/$/,                    // Ends with slash
    /\.lock$/,                // Ends with .lock
    /^$/,                     // Empty string
  ];
  
  return !invalidPatterns.some(pattern => pattern.test(branchName));
}

/**
 * Escapes shell arguments safely
 * @param arg The argument to escape
 * @returns Escaped argument safe for shell execution
 */
export function escapeShellArg(arg: string): string {
  // For safety, wrap in single quotes and escape any single quotes
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Validates and sanitizes file names
 * @param fileName The file name to validate
 * @returns Sanitized file name or null if invalid
 */
export function validateFileName(fileName: string): string | null {
  // Check for dangerous patterns first
  if (!fileName || fileName === '.' || fileName === '..' || fileName.startsWith('../')) {
    return null;
  }
  
  // Remove path separators and null bytes
  const cleaned = fileName
    .replace(/[/\\]/g, '') // Remove path separators
    .replace(/\0/g, '');   // Remove null bytes
  
  // Check if cleaned result is empty or dangerous
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    return null;
  }
  
  return cleaned;
}

/**
 * Creates a safe exec function that validates commands
 * @param command The command to execute
 * @param args Array of arguments
 * @param options Execution options
 * @returns Promise with execution result
 */
export async function safeExec(
  command: string,
  args: string[],
  options?: { cwd?: string }
): Promise<{ stdout: string; stderr: string }> {
  // Whitelist of allowed commands
  const allowedCommands = ['git', 'npm', 'bun', 'node', 'npx', 'gh'];
  
  const baseCommand = command.split(' ')[0];
  if (!allowedCommands.includes(baseCommand)) {
    throw new Error(`Command '${baseCommand}' is not allowed`);
  }
  
  // Escape all arguments
  const escapedArgs = args.map(arg => escapeShellArg(arg));
  const fullCommand = `${command} ${escapedArgs.join(' ')}`;
  
  return new Promise((resolve, reject) => {
    exec(fullCommand, options || {}, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

/**
 * Validates API input to prevent injection attacks
 * @param input The input to validate
 * @param maxLength Maximum allowed length
 * @returns true if valid, false otherwise
 */
export function validateApiInput(input: unknown, maxLength: number = 1000): boolean {
  if (typeof input !== 'string') {
    return false;
  }
  
  if (input.length > maxLength) {
    return false;
  }
  
  // Check for common injection patterns
  const dangerousPatterns = [
    /<script[^>]*>/i,      // Script tags
    /javascript:/i,        // JavaScript protocol
    /on\w+\s*=/i,         // Event handlers
    /\0/,                 // Null bytes
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(input));
}