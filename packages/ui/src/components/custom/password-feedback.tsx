// utils/passwordUtils.ts
function hasMinimumLength(password: string, minLength: number = 8): boolean {
  return password.length >= minLength;
}

function hasNumbers(password: string): boolean {
  return /\d/.test(password);
}

function hasSpecialCharacters(password: string): boolean {
  return /[!@#$%^&*(),.?":{}|<>]/.test(password);
}

function hasCapitalAndLowerCaseLetter(password: string): boolean {
  return /[a-z]/.test(password) && /[A-Z]/.test(password);
}

function getStrengthPercentage(strength: string): number {
  const strengthMap: Record<string, number> = {
    weak: 33,
    medium: 66,
    strong: 100,
  };
  return strengthMap[strength] || 0;
}

function evaluatePasswordStrength(password: string): string {
  const checks = [
    hasMinimumLength(password),
    hasNumbers(password),
    hasSpecialCharacters(password),
    hasCapitalAndLowerCaseLetter(password),
  ];
  const passedChecks = checks.filter(Boolean).length;

  if (passedChecks === 4) return "strong";
  if (passedChecks >= 2) return "medium";
  return "weak";
}

type PasswordFeedbackProps = {
  password: string;
  strength?: "weak" | "medium" | "strong";
};

export function PasswordFeedback({ password }: PasswordFeedbackProps) {
  const requirements = [
    {
      label: "At least 8 characters",
      isMet: hasMinimumLength(password),
    },
    {
      label: "Contains a number",
      isMet: hasNumbers(password),
    },
    {
      label: "Contains a special character",
      isMet: hasSpecialCharacters(password),
    },
    {
      label: "Contains a capital and lowercase letter",
      isMet: hasCapitalAndLowerCaseLetter(password),
    },
  ];

  const strengthStyles = {
    weak: {
      bar: "bg-red-500",
      text: "text-red-500",
      bg: "bg-red-100",
    },
    medium: {
      bar: "bg-orange-500",
      text: "text-orange-500",
      bg: "bg-orange-100",
    },
    strong: {
      bar: "bg-green-500",
      text: "text-green-500",
      bg: "bg-green-100",
    },
  };
  const strength = evaluatePasswordStrength(password);
  const percentage = getStrengthPercentage(strength);
  const currentStyle = strengthStyles[strength as keyof typeof strengthStyles];

  return (
    <div className="space-y-4 text-xs">
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full transition-all duration-300 ease-in-out ${currentStyle.bar}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div
        className={`flex items-center gap-2 font-medium ${currentStyle.text}`}
      >
        <div className={`h-2 w-2 rounded-full ${currentStyle.bg}`} />
        <span>
          {strength.charAt(0).toUpperCase() + strength.slice(1)} Password
        </span>
      </div>
      <ul className="space-y-1">
        {requirements.map((req, index) => (
          <li key={index} className="flex items-center gap-2">
            {req.isMet ? (
              <span className="text-green-500">✓</span>
            ) : (
              <span className="text-gray-400">○</span>
            )}
            <span className={req.isMet ? "text-green-500" : "text-gray-400"}>
              {req.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
