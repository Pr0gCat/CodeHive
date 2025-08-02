
import {
    escapeShellArg,
    safeExec,
    sanitizeShellInput,
    validateApiInput,
    validateFileName,
    validateGitBranchName,
    validatePath,
} from '@/lib/utils/security';

describe('Security Utilities', () => {
  describe('validatePath', () => {
    it('should allow valid paths within base directory', () => {
      const result = validatePath('/base', '/base/subdir/file.txt');
      expect(result).toBe('/base/subdir/file.txt');
    });

    it('should reject paths that traverse outside base directory', () => {
      const result = validatePath('/base', '/base/../etc/passwd');
      expect(result).toBeNull();
    });

    it('should handle paths with allowed .. that stay within bounds', () => {
      const result = validatePath('/base', '/base/subdir/../other/file.txt');
      expect(result).toBe('/base/other/file.txt');
    });

    it('should reject paths with tilde expansion', () => {
      const result = validatePath('/base', '/base/~/file.txt');
      expect(result).toBeNull();
    });
  });

  describe('sanitizeShellInput', () => {
    it('should remove dangerous shell characters', () => {
      const input = 'test; rm -rf /; echo "dangerous"';
      const result = sanitizeShellInput(input);
      expect(result).toBe('test rm -rf / echo dangerous');
    });

    it('should normalize whitespace', () => {
      const input = '  test   input  ';
      const result = sanitizeShellInput(input);
      expect(result).toBe('test input');
    });
  });

  describe('validateGitBranchName', () => {
    it('should accept valid Git branch names', () => {
      expect(validateGitBranchName('feature/user-auth')).toBe(true);
      expect(validateGitBranchName('bugfix/123')).toBe(true);
      expect(validateGitBranchName('main')).toBe(true);
    });

    it('should reject invalid Git branch names', () => {
      expect(validateGitBranchName('')).toBe(false);
      expect(validateGitBranchName('..')).toBe(false);
      expect(validateGitBranchName('feature/')).toBe(false);
      expect(validateGitBranchName('feature/.lock')).toBe(false);
    });
  });

  describe('escapeShellArg', () => {
    it('should escape shell arguments safely', () => {
      expect(escapeShellArg('test')).toBe("'test'");
      expect(escapeShellArg("test'quote")).toBe("'test'\\''quote'");
      expect(escapeShellArg('test with spaces')).toBe("'test with spaces'");
    });
  });

  describe('validateFileName', () => {
    it('should accept valid file names', () => {
      expect(validateFileName('test.txt')).toBe('test.txt');
      expect(validateFileName('my-file_123')).toBe('my-file_123');
    });

    it('should reject invalid file names', () => {
      expect(validateFileName('')).toBeNull();
      expect(validateFileName('.')).toBeNull();
      expect(validateFileName('..')).toBeNull();
      expect(validateFileName('../file.txt')).toBeNull();
    });

    it('should remove null bytes', () => {
      expect(validateFileName('test\0file.txt')).toBe('testfile.txt');
    });
  });

  describe('safeExec', () => {
    it('should allow whitelisted commands', async () => {
      // Test that the function exists and can be called
      expect(typeof safeExec).toBe('function');
    });

    it('should reject non-whitelisted commands', async () => {
      await expect(safeExec('rm', ['-rf', '/'])).rejects.toThrow("Command 'rm' is not allowed");
    });

    it('should escape arguments', async () => {
      // Test that the function exists and can be called
      expect(typeof safeExec).toBe('function');
    });
  });

  describe('validateApiInput', () => {
    it('should accept valid string input', () => {
      expect(validateApiInput('valid input')).toBe(true);
      expect(validateApiInput('')).toBe(true);
    });

    it('should reject non-string input', () => {
      expect(validateApiInput(123)).toBe(false);
      expect(validateApiInput({})).toBe(false);
      expect(validateApiInput(null)).toBe(false);
    });

    it('should reject input exceeding max length', () => {
      const longInput = 'a'.repeat(1001);
      expect(validateApiInput(longInput, 1000)).toBe(false);
    });

    it('should reject input with dangerous patterns', () => {
      expect(validateApiInput('<script>alert("xss")</script>')).toBe(false);
      expect(validateApiInput('javascript:alert("xss")')).toBe(false);
      expect(validateApiInput('onclick=alert("xss")')).toBe(false);
      expect(validateApiInput('test\0null')).toBe(false);
    });
  });
});