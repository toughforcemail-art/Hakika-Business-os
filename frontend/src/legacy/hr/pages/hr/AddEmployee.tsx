// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, User, Briefcase, Heart, GraduationCap, Building2, CreditCard, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { MODULES } from '../../constants';
import { invokeEdgeFunction } from '../../utils/edgeFunctions';
import { formatPhoneInput, normalizePhoneNumber } from '../../utils/phoneNumbers';
import { KENYAN_BANKS, branchesForKenyanBank } from '../../data/kenyanBanks';

const DEFAULT_ROLE_OPTIONS = [
  'Hakika Admin',
  'HR Admin',
  'ToughForce Admin',
  'Finance Admin',
  'Real Estate Admin',
  'Super Admin',
  'Director',
  'Director / Super Admin',
  'Administrator',
  'HR Manager',
  'Security Manager',
  'Finance Manager',
  'Property Manager',
  'Accountant',
  'Employee',
];

const DEFAULT_MODULE_ACCESS = ['HR', 'Real Estate', 'ToughForce', 'Finance', 'Platform Admin'];

// InputField MUST be at module level — if defined inside a component, React
interface InputFieldProps {
  label: string;
  field: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  formData: Record<string, any>;
  errors: Record<string, string>;
  onChange: (field: string, value: any) => void;
}

const InputField: React.FC<InputFieldProps> = ({ label, field, type = 'text', required = false, placeholder = '', options = [], formData, errors, onChange }) => {
  const value = formData[field] as string ?? '';
  const error = errors[field];

  const inputId = `field-${field}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="text-xs font-medium text-gray-700 dark:text-gray-300">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {type === 'select' ? (
        <select
          id={inputId}
          value={value}
          onChange={(e) => onChange(field, e.target.value)}
          title={`Select ${label}`}
          className={`w-full bg-white dark:bg-[#0A1628] border ${
            error ? 'border-red-500' : 'border-gray-300 dark:border-[#1e293b]'
          } px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm text-gray-900 dark:text-white`}
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          id={inputId}
          value={value}
          onChange={(e) => onChange(field, e.target.value)}
          placeholder={placeholder}
          title={label}
          className={`w-full bg-white dark:bg-[#0A1628] border ${
            error ? 'border-red-500' : 'border-gray-300 dark:border-[#1e293b]'
          } px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm h-24 resize-none text-gray-900 dark:text-white`}
        />
      ) : (
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={(e) => onChange(field, e.target.value)}
          placeholder={placeholder}
          title={label}
          className={`w-full bg-white dark:bg-[#0A1628] border ${
            error ? 'border-red-500' : 'border-gray-300 dark:border-[#1e293b]'
          } px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm text-gray-900 dark:text-white`}
        />
      )}
      {error && (
        <div className="flex items-center gap-1 text-red-500 text-xs">
          <AlertCircle size={12} />{error}
        </div>
      )}
    </div>
  );
};

interface NextOfKin {
  name: string;
  relationship: string;
  phone: string;
  email: string;
  address: string;
}

interface Education {
  type: string;
  school: string;
  entry: string;
  exit: string;
  qualification: string;
  dropoutGrade: string;
}

interface Tertiary {
  institution: string;
  course: string;
  qualification: string;
  year: string;
  additionalCourses: string;
}

interface Employment {
  employeeName: string;
  company: string;
  dateJoined: string;
  dateLeft: string;
  position: string;
  reasonLeaving: string;
  refFirstName: string;
  refSecondName: string;
  refLastName: string;
  refId: string;
  refEmail: string;
  refRelationship: string;
}

const AddEmployee: React.FC = () => {
  const navigate = useNavigate();
  const [currentSection, setCurrentSection] = useState(() => {
    const saved = localStorage.getItem('employee_draft_section');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [deliveryStatus, setDeliveryStatus] = useState<{ emailSent: boolean; smsSent: boolean; warnings: string[] }>({
    emailSent: false,
    smsSent: false,
    warnings: [],
  });
  const [saveSummary, setSaveSummary] = useState<{ salary: string; startDate: string; fieldsCaptured: number } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File>>({});
  const [departments, setDepartments] = useState<string[]>([]);
  const [designations, setDesignations] = useState<string[]>(DEFAULT_ROLE_OPTIONS);
  const [modules, setModules] = useState<string[]>(DEFAULT_MODULE_ACCESS);
  const [banks, setBanks] = useState<Array<{name: string, code: string}>>([]);
  
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const saved = localStorage.getItem('employee_draft');
    const baseData = (saved ? JSON.parse(saved) : {
      firstName: '', secondName: '', lastName: '', username: '', idNumber: '',
      dateOfBirth: '', religion: '', gender: '', maritalStatus: '', nssf: '',
      sha: '', kraPin: '', department: '', employmentType: '', pwdStatus: '',
      email: '', designation: '', directorDepartment: '', originalHome: '', currentResidence: '',
      phoneNumber: formatPhoneInput(''), employmentStartDate: '', salary: '', statutoryDeductions: [] as string[], statutoryDeductionsOther: '', module: [] as string[],
      bankName: '', branchCode: '', accountNumber: '', bankBranch: '',
      primarySchool: '', primaryFrom: '', primaryTo: '',
      secondarySchool: '', secondaryFrom: '', secondaryTo: '',
      collegeQualification: '', courseName: '', qualificationStatus: '',
      otherCourses: '',
      employer1Name: '', employer1DateJoined: '', employer1DateLeft: '',
      employer1Position: '', employer1ReasonLeaving: '',
      employer2Name: '', employer2DateJoined: '', employer2DateLeft: '',
      employer2Position: '', employer2ReasonLeaving: '',
      ref1Name: '', ref1Id: '', ref1Email: '', ref1Relationship: '',
      ref2Name: '', ref2Id: '', ref2Email: '', ref2Relationship: '',
      chronicCondition: '', medicalNotes: '', consentGiven: false, chronicConditionOther: ''
    }) as Record<string, any>;

    return {
      ...baseData,
      phoneNumber: formatPhoneInput(baseData.phoneNumber),
    };
  });

  const [nextOfKin, setNextOfKin] = useState<NextOfKin[]>(() => {
    const saved = localStorage.getItem('employee_draft_nok');
    if (saved) {
      return (JSON.parse(saved) as NextOfKin[]).map((entry) => ({
        ...entry,
        phone: formatPhoneInput(entry.phone),
      }));
    }

    return [{ name: '', relationship: '', phone: formatPhoneInput(''), email: '', address: '' }];
  });
  const [education, setEducation] = useState<Education[]>(() => {
    const saved = localStorage.getItem('employee_draft_education');
    return saved ? JSON.parse(saved) : [
      { type: 'Primary', school: '', entry: '', exit: '', qualification: '', dropoutGrade: '' },
      { type: 'Secondary', school: '', entry: '', exit: '', qualification: '', dropoutGrade: '' }
    ];
  });
  const [tertiary, setTertiary] = useState<Tertiary[]>(() => {
    const saved = localStorage.getItem('employee_draft_tertiary');
    return saved ? JSON.parse(saved) : [{ institution: '', course: '', qualification: '', year: '', additionalCourses: '' }];
  });
  const [employment, setEmployment] = useState<Employment[]>(() => {
    const saved = localStorage.getItem('employee_draft_employment');
    return saved ? JSON.parse(saved) : [{ employeeName: '', company: '', dateJoined: '', dateLeft: '', position: '', reasonLeaving: '', refFirstName: '', refSecondName: '', refLastName: '', refId: '', refEmail: '', refRelationship: '' }];
  });

  // Auto-save draft on every change
  useEffect(() => {
    localStorage.setItem('employee_draft', JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    localStorage.setItem('employee_draft_nok', JSON.stringify(nextOfKin));
  }, [nextOfKin]);

  useEffect(() => {
    localStorage.setItem('employee_draft_education', JSON.stringify(education));
  }, [education]);

  useEffect(() => {
    localStorage.setItem('employee_draft_tertiary', JSON.stringify(tertiary));
  }, [tertiary]);

  useEffect(() => {
    localStorage.setItem('employee_draft_employment', JSON.stringify(employment));
  }, [employment]);

  useEffect(() => {
    localStorage.setItem('employee_draft_section', currentSection.toString());
  }, [currentSection]);

  // Load data on mount
  useEffect(() => {
    fetchDepartmentsAndRoles();
  }, []);

  const fetchDepartmentsAndRoles = async () => {
    try {
      const [deptRes, desigRes, modRes, bankRes] = await Promise.all([
        supabase.schema('hr').from('departments').select('name').eq('status', 'active').order('name'),
        supabase.schema('hr').from('designations').select('title:name').eq('status', 'active').order('name'),
        supabase.from('modules').select('name').eq('is_active', true).order('name'),
        supabase.from('banks').select('name, code').eq('is_active', true).order('name')
      ]);

      const defaultDepts = ['Real Estate', 'Property Management', 'HR', 'Finance', 'Security', 'IT', 'Operations'];
      const defaultDesigs = ['Property Manager', 'Caretaker', 'Real Estate Agent', 'HR Manager', 'Accountant', 'Security Guard', 'IT Manager'];

      if (deptRes.data && deptRes.data.length > 0) {
        setDepartments(deptRes.data.map(d => d.name));
      } else {
        setDepartments(defaultDepts);
      }

      if (desigRes.data && desigRes.data.length > 0) {
        setDesignations([...new Set([...DEFAULT_ROLE_OPTIONS, ...defaultDesigs, ...desigRes.data.map(d => d.title)])]);
      } else {
        setDesignations(DEFAULT_ROLE_OPTIONS);
      }

      setModules([...new Set([...DEFAULT_MODULE_ACCESS, ...(modRes.data ?? []).map(m => m.name)])]);
      // Keep the database as the source for customer-specific additions, but
      // never leave payroll onboarding with an empty bank selector when the
      // optional legacy `banks` table has not been seeded.
      setBanks((bankRes.data && bankRes.data.length > 0) ? bankRes.data : KENYAN_BANKS);
    } catch (error) {
      console.error('Error fetching data:', error);
      setDepartments(['Real Estate', 'Property Management', 'HR', 'Finance', 'Security', 'IT', 'Operations']);
      setDesignations(['Property Manager', 'Caretaker', 'Real Estate Agent', 'HR Manager', 'Accountant', 'Security Guard', 'IT Manager']);
    }
  };

  const sections = [
    { title: 'Primary Details', icon: User },
    { title: 'Bank Information', icon: CreditCard },
    { title: 'Next of Kin & Dependants', icon: Heart },
    { title: 'Education & Qualifications', icon: GraduationCap },
    { title: 'Employment History', icon: Briefcase },
    { title: 'Medical & Consent', icon: Building2 }
  ];

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePhone = (phone: string) => /^(\+254|0)[17]\d{8}$/.test(phone);
  const validateID = (id: string) => /^\d{7,8}$/.test(id);

  const validateSection = (section: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (section === 0) {
      if (!formData.firstName) newErrors.firstName = 'Required';
      if (!formData.lastName) newErrors.lastName = 'Required';
      if (!formData.idNumber) newErrors.idNumber = 'Required';
      else if (!validateID(formData.idNumber)) newErrors.idNumber = 'Invalid ID format';
      if (!formData.gender) newErrors.gender = 'Required';
      if (!formData.department) newErrors.department = 'Required';
      if (!formData.designation) newErrors.designation = 'Required';
      if (!formData.employmentType) newErrors.employmentType = 'Required';
      if (!formData.phoneNumber) newErrors.phoneNumber = 'Required';
      else if (!validatePhone(formData.phoneNumber)) newErrors.phoneNumber = 'Invalid phone format';
      if (!formData.email) newErrors.email = 'Email is required';
      else if (!validateEmail(formData.email)) newErrors.email = 'Invalid email';
    }

    if (section === 1) {
      if (!formData.bankName) newErrors.bankName = 'Required';
      if (!formData.accountNumber) newErrors.accountNumber = 'Required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateAllRequiredSections = (): boolean => {
    const sectionChecks = [0, 1];
    const results = sectionChecks.map((section) => validateSection(section));
    return results.every(Boolean);
  };

  const handleFileUpload = async (field: string, file: File) => {
    setUploadedFiles(prev => ({ ...prev, [field]: file }));
  };

  const generateCredentials = () => {
    const username = formData.username || `${formData.firstName.toLowerCase()}.${formData.lastName.toLowerCase()}`;
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase();
    return { username, tempPassword };
  };

  const handleSubmit = async () => {
    if (!validateAllRequiredSections()) {
      setCurrentSection(0);
      return;
    }
    
    const { username, tempPassword } = generateCredentials();
    setCredentials({ username, password: tempPassword });
    setShowConfirmModal(true);
  };

  const confirmAndCreate = async () => {
    setShowConfirmModal(false);
    setIsSubmitting(true);
    try {
      const { username, password: tempPassword } = credentials;
      const fullName = `${formData.firstName} ${formData.secondName} ${formData.lastName}`.trim();
      const email = formData.email;
      const normalizedPhoneNumber = normalizePhoneNumber(formData.phoneNumber);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('You must be logged in to add an employee');

      const funcData = await invokeEdgeFunction('admin-create-user', {
        email: email.trim(),
        password: tempPassword,
        userData: {
          full_name: fullName,
          username: username.trim(),
          role: formData.designation?.includes('Manager') ? 'Property Manager' : 'Employee',
          is_approved: true,
          first_name: formData.firstName,
          second_name: formData.secondName,
          last_name: formData.lastName,
          date_of_birth: formData.dateOfBirth || null,
          gender: formData.gender,
          marital_status: formData.maritalStatus || null,
          religion: formData.religion || null,
          phone: normalizedPhoneNumber,
          phone_number: normalizedPhoneNumber,
          id_number: formData.idNumber,
          original_home: formData.originalHome || null,
          current_residence: formData.currentResidence || null,
          department: formData.department,
          designation: formData.designation,
          employment_type: formData.employmentType,
          employment_start_date: formData.employmentStartDate || null,
          salary: formData.salary || null,
          module: formData.module.length > 0 ? formData.module.join(',') : null,
          nssf: formData.nssf || null,
          sha: formData.sha || null,
          kra_pin: formData.kraPin || null,
          bank_name: formData.bankName,
          branch_code: formData.branchCode || null,
          account_number: formData.accountNumber,
          bank_branch: (formData.bankBranch === 'Other' ? formData.otherBankBranch : formData.bankBranch) || null,
          pwd_status: formData.pwdStatus === 'Yes',
          chronic_condition: formData.chronicCondition === 'Other' ? formData.chronicConditionOther : formData.chronicCondition,
          medical_notes: formData.medicalNotes || null,
          statutory_deductions: formData.statutoryDeductions.includes('Other') 
            ? [...formData.statutoryDeductions.filter((d: string) => d !== 'Other'), formData.statutoryDeductionsOther]
            : formData.statutoryDeductions,
          dependants: nextOfKin.map((entry) => ({
            ...entry,
            phone: normalizePhoneNumber(entry.phone) || '',
          })),
          education: [...education, ...tertiary],
          employment_history: employment,
        },
        sendEmail: true,
        sendSms: true
      }, {
        accessToken: session.access_token
      });
      if (!funcData?.user) throw new Error('Failed to create user account');

      const user = funcData.user;
      setSaveSummary({
        salary: String(formData.salary || '0'),
        startDate: formData.employmentStartDate || '-',
        fieldsCaptured: Object.values({
          ...formData,
          dependants: nextOfKin,
          education: [...education, ...tertiary],
          employment_history: employment,
        }).filter((value) => {
          if (Array.isArray(value)) return value.length > 0;
          return Boolean(value);
        }).length,
      });
      setDeliveryStatus({
        emailSent: !!funcData?.emailSent,
        smsSent: !!funcData?.smsSent,
        warnings: Array.isArray(funcData?.warnings) ? funcData.warnings : [],
      });

      // Upload files if any
      for (const [field, file] of Object.entries(uploadedFiles) as [string, File][]) {
        const filePath = `employees/${user.id}/${field}_${Date.now()}`;
        await supabase.storage.from('documents').upload(filePath, file);
      }

      // Clear all drafts
      localStorage.removeItem('employee_draft');
      localStorage.removeItem('employee_draft_nok');
      localStorage.removeItem('employee_draft_education');
      localStorage.removeItem('employee_draft_tertiary');
      localStorage.removeItem('employee_draft_employment');
      localStorage.removeItem('employee_draft_section');
      
      setIsSuccess(true);
    } catch (error: any) {
      console.error('Error adding employee:', error);
      
      let errorMessage = error.message || 'Failed to create employee';
      
      // Handle structured errors from Edge Functions
      if (error.context instanceof Response) {
        try {
          // Clone to avoid reading used stream
          const response = error.context.clone();
          const json = await response.json();
          console.error('Edge Function JSON Error:', json);
          if (json.error) errorMessage = json.error;
          if (json.details) console.error('Edge Function Details:', json.details);
        } catch (e) {
          try {
            const text = await error.context.text();
            console.error('Edge Function Text Error:', text);
            errorMessage = text || errorMessage;
          } catch (textErr) {
            console.error('Failed to read error body');
          }
        }
      } else if (error.context?.json) { // Fallback for different client versions
        const json = error.context.json;
        if (json.error) errorMessage = json.error;
        console.error('Edge Function Error:', json.error);
      }
      
      setErrors({ submit: errorMessage });
      setShowConfirmModal(false);
      
      // Log technical details for debugging as requested
      if (error.context instanceof Response) {
        console.warn('Technical error details available in network tab or backend logs.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = useCallback((field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: field === 'phoneNumber' ? formatPhoneInput(String(value)) : value }));
    setErrors(prev => {
      if (prev[field]) {
        const { [field]: removed, ...rest } = prev;
        return rest;
      }
      return prev;
    });
  }, []);

  const handleNext = () => {
    if (validateSection(currentSection)) {
      setCurrentSection(currentSection + 1);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-[#020817]">
        <div className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#1e293b] rounded-xl p-8 text-center max-w-md w-full shadow-xl">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Employee Added Successfully</h2>
          {saveSummary ? (
            <div className="bg-gray-50 dark:bg-[#0A1628] p-4 rounded-lg border border-gray-200 dark:border-[#1e293b] text-left text-sm text-gray-700 dark:text-gray-300 mb-4">
              <p className="flex justify-between gap-4"><span>Salary saved</span><strong>{saveSummary.salary}</strong></p>
              <p className="flex justify-between gap-4 mt-2"><span>Start date</span><strong>{saveSummary.startDate}</strong></p>
              <p className="flex justify-between gap-4 mt-2"><span>Fields captured</span><strong>{saveSummary.fieldsCaptured}</strong></p>
            </div>
          ) : null}
          <div className="bg-gray-50 dark:bg-[#0A1628] p-4 rounded-lg border border-gray-200 dark:border-[#1e293b] mb-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Login Credentials</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Username:</span>
                <span className="text-sm font-mono font-semibold text-gray-900 dark:text-white">{credentials.username}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Password:</span>
                <span className="text-sm font-mono font-semibold text-gray-900 dark:text-white">{credentials.password}</span>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-blue-700 dark:text-blue-300 text-xs mb-6 border border-blue-100 dark:border-blue-800/30">
            <p><strong>Note:</strong> On their first login, the employee will be prompted to update their temporary password and verify their email address for security.</p>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
            Credentials sent to:<br/>
            Email: <span className="font-semibold">{formData.email || 'No email'}</span><br/>
            SMS: <span className="font-semibold">{formData.phoneNumber || 'No phone'}</span>
          </p>
          <div className="bg-gray-50 dark:bg-[#0A1628] p-4 rounded-lg border border-gray-200 dark:border-[#1e293b] text-left text-sm text-gray-700 dark:text-gray-300 mb-6">
            <p>Email delivery: <span className="font-semibold">{deliveryStatus.emailSent ? 'Sent' : 'Not confirmed'}</span></p>
            <p>SMS delivery: <span className="font-semibold">{deliveryStatus.smsSent ? 'Sent' : 'Not confirmed'}</span></p>
            {deliveryStatus.warnings.length > 0 && (
              <p className="text-amber-600 dark:text-amber-400 mt-2">
                {deliveryStatus.warnings.join(' | ')}
              </p>
            )}
          </div>
          <button 
            onClick={() => navigate('/app/hr/total-employees')}
            className="w-full py-2.5 bg-black dark:bg-white text-white dark:text-black text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            View All Employees
          </button>
        </div>
      </div>
    );
  }


  // renderSection uses InputField which is now at module level, so no focus-loss.
  const renderSection = () => {
    switch (currentSection) {
      case 0:
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <InputField label="First Name" field="firstName" required placeholder="John" formData={formData} errors={errors} onChange={handleInputChange} />
              <InputField label="Second Name" field="secondName" placeholder="Kwame" formData={formData} errors={errors} onChange={handleInputChange} />
              <InputField label="Last Name" field="lastName" required placeholder="Doe" formData={formData} errors={errors} onChange={handleInputChange} />
              <InputField label="Username (Optional)" field="username" placeholder="j.doe" formData={formData} errors={errors} onChange={handleInputChange} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="ID / Passport" field="idNumber" required placeholder="34567890" formData={formData} errors={errors} onChange={handleInputChange} />
              <InputField label="Date of Birth" field="dateOfBirth" type="date" formData={formData} errors={errors} onChange={handleInputChange} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InputField label="Gender" field="gender" type="select" required options={['Male', 'Female', 'Other']} placeholder="Select Gender" formData={formData} errors={errors} onChange={handleInputChange} />
              <InputField label="Marital Status" field="maritalStatus" type="select" options={['Single', 'Married', 'Divorced', 'Widowed']} placeholder="Select Status" formData={formData} errors={errors} onChange={handleInputChange} />
              <InputField label="Religion" field="religion" type="select" options={['Christian', 'Muslim', 'Hindu', 'Other', 'Prefer not to say']} placeholder="Select Religion" formData={formData} errors={errors} onChange={handleInputChange} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InputField label="NSSF Number" field="nssf" placeholder="NSSF Number" formData={formData} errors={errors} onChange={handleInputChange} />
              <InputField label="SHA No" field="sha" placeholder="SHA Number" formData={formData} errors={errors} onChange={handleInputChange} />
              <InputField label="KRA PIN" field="kraPin" placeholder="KRA PIN" formData={formData} errors={errors} onChange={handleInputChange} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Email" field="email" type="email" required placeholder="john@hakika.com" formData={formData} errors={errors} onChange={handleInputChange} />
              <InputField label="Phone Number" field="phoneNumber" required placeholder="+254712345678" formData={formData} errors={errors} onChange={handleInputChange} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Original Home" field="originalHome" placeholder="County/Town" formData={formData} errors={errors} onChange={handleInputChange} />
              <InputField label="Current Residence" field="currentResidence" placeholder="Current Address" formData={formData} errors={errors} onChange={handleInputChange} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Modules Access</label>
                <div className="flex flex-wrap gap-2">
                  {modules.map(mod => (
                    <label key={mod} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-[#0A1628] rounded border border-gray-200 dark:border-[#1e293b] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(formData.module as unknown as string[]).includes(mod)}
                        onChange={(e) => {
                          const current = (formData.module as unknown as string[]) || [];
                          if (e.target.checked) {
                            handleInputChange('module', [...current, mod]);
                          } else {
                            handleInputChange('module', current.filter(m => m !== mod));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-xs text-gray-700 dark:text-gray-300">{mod}</span>
                    </label>
                  ))}
                </div>
              </div>
              <InputField label="PWD Status" field="pwdStatus" type="select" options={['No', 'Yes']} placeholder="Select" formData={formData} errors={errors} onChange={handleInputChange} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InputField label="Department" field="department" type="select" required options={departments} placeholder="Select Department" formData={formData} errors={errors} onChange={handleInputChange} />
              <InputField label="Role / Designation" field="designation" type="select" required options={designations} placeholder="Select role or designation" formData={formData} errors={errors} onChange={handleInputChange} />
              {formData.designation?.toLowerCase().includes('director') && (
                <div className="space-y-1.5">
                  <label htmlFor="director-dept" className="text-xs font-medium text-gray-700 dark:text-gray-300">Director Department *</label>
                  <select
                    id="director-dept"
                    value={formData.directorDepartment}
                    onChange={(e) => handleInputChange('directorDepartment', e.target.value)}
                    title="Select Director Department"
                    className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    required
                  >
                    <option value="">Select Department</option>
                    <option value="IT">IT</option>
                    <option value="Operations">Operations</option>
                    <option value="HR">HR</option>
                    <option value="Finance">Finance</option>
                  </select>
                </div>
              )}
              <InputField label="Employment Type" field="employmentType" type="select" required options={['Permanent', 'Casual', 'Consultant']} placeholder="Select Type" formData={formData} errors={errors} onChange={handleInputChange} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Employment Start Date" field="employmentStartDate" type="date" formData={formData} errors={errors} onChange={handleInputChange} />
              <InputField label="Salary" field="salary" type="number" placeholder="Monthly Salary" formData={formData} errors={errors} onChange={handleInputChange} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Statutory Deductions</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {['None', 'NSSF', 'SHA', 'PAYE', 'Affordable Housing', 'HELB Loan', 'Other'].map(ded => (
                  <label key={ded} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-[#0A1628] rounded border border-gray-200 dark:border-[#1e293b] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.statutoryDeductions.includes(ded)}
                      onChange={(e) => {
                        const current = formData.statutoryDeductions;
                        if (e.target.checked) {
                          handleInputChange('statutoryDeductions', [...current, ded]);
                        } else {
                          handleInputChange('statutoryDeductions', current.filter((d: string) => d !== ded));
                          if (ded === 'Other') handleInputChange('statutoryDeductionsOther', '');
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-xs text-gray-700 dark:text-gray-300">{ded}</span>
                  </label>
                ))}
              </div>
              {formData.statutoryDeductions.includes('Other') && (
                <input
                  type="text"
                  value={formData.statutoryDeductionsOther}
                  onChange={(e) => handleInputChange('statutoryDeductionsOther', e.target.value)}
                  placeholder="Specify other deduction"
                  className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm mt-2"
                />
              )}
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="bank-name" className="text-xs font-medium text-gray-700 dark:text-gray-300">Bank Name *</label>
                <select
                  id="bank-name"
                  value={formData.bankName}
                  onChange={(e) => handleInputChange('bankName', e.target.value)}
                  title="Select Bank Name"
                  className={`w-full bg-white dark:bg-[#0A1628] border ${errors.bankName ? 'border-red-500' : 'border-gray-300 dark:border-[#1e293b]'} px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm text-gray-900 dark:text-white`}
                >
                  <option value="">Select Bank</option>
                  {banks.map((bank) => (
                    <option key={bank.code} value={bank.name}>{bank.name} ({bank.code})</option>
                  ))}
                </select>
                {errors.bankName && (
                  <div className="flex items-center gap-1 text-red-500 text-xs">
                    <AlertCircle size={12} />
                    {errors.bankName}
                  </div>
                )}
              </div>
                <div className="space-y-1.5">
                  <label htmlFor="bank-branch" className="text-xs font-medium text-gray-700 dark:text-gray-300">Branch Name</label>
                  <select
                    id="bank-branch"
                    value={formData.bankBranch}
                    onChange={(e) => handleInputChange('bankBranch', e.target.value)}
                    className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 dark:text-white"
                  >
                    <option value="">Select branch</option>
                    {branchesForKenyanBank(formData.bankName).map((branch) => <option key={branch} value={branch}>{branch}</option>)}
                    <option value="Other">Other branch</option>
                  </select>
                  {formData.bankBranch === 'Other' && <input value={formData.otherBankBranch || ''} onChange={(e) => handleInputChange('otherBankBranch', e.target.value)} placeholder="Enter branch name" className="mt-2 w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg text-sm text-gray-900 dark:text-white" />}
                </div>
            </div>
            <InputField label="Account Number" field="accountNumber" required placeholder="1122334455" formData={formData} errors={errors} onChange={handleInputChange} />
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            {nextOfKin.map((nok, idx) => (
              <div key={idx} className="border border-gray-300 dark:border-[#1e293b] rounded-lg p-4 relative">
                {nextOfKin.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => setNextOfKin(nextOfKin.filter((_, i) => i !== idx))} 
                    title="Remove next of kin contact"
                    aria-label="Remove"
                    className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-lg"
                  >✕</button>
                )}
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Next of Kin {idx + 1}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor={`nok-name-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">Name *</label>
                    <input id={`nok-name-${idx}`} type="text" value={nok.name} onChange={(e) => { const u = [...nextOfKin]; u[idx].name = e.target.value; setNextOfKin(u); }} placeholder="e.g. Jane Doe" title="Next of Kin Name" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" required />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor={`nok-rel-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">Relationship *</label>
                    <select id={`nok-rel-${idx}`} value={nok.relationship} onChange={(e) => { const u = [...nextOfKin]; u[idx].relationship = e.target.value; setNextOfKin(u); }} title="Relationship to Employee" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" required>
                      <option value="">Select Relationship</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Parent">Parent</option>
                      <option value="Child">Child</option>
                      <option value="Sibling">Sibling</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor={`nok-phone-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">Phone *</label>
                    <input id={`nok-phone-${idx}`} type="tel" value={nok.phone} onChange={(e) => { const u = [...nextOfKin]; u[idx].phone = formatPhoneInput(e.target.value); setNextOfKin(u); }} placeholder="e.g. +254712345678" title="Next of Kin Phone" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" required />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor={`nok-email-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">Email</label>
                    <input id={`nok-email-${idx}`} type="email" value={nok.email} onChange={(e) => { const u = [...nextOfKin]; u[idx].email = e.target.value; setNextOfKin(u); }} placeholder="e.g. jane.doe@example.com" title="Next of Kin Email" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label htmlFor={`nok-addr-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">Address *</label>
                    <input id={`nok-addr-${idx}`} type="text" value={nok.address} onChange={(e) => { const u = [...nextOfKin]; u[idx].address = e.target.value; setNextOfKin(u); }} placeholder="Physical or postal address" title="Next of Kin Address" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" required />
                  </div>
                </div>
              </div>
            ))}
            <button 
              type="button" 
              onClick={() => setNextOfKin([...nextOfKin, { name: '', relationship: '', phone: formatPhoneInput(''), email: '', address: '' }])} 
              title="Add another next of kin entry"
              className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 text-sm"
            >+ Add Another Next of Kin</button>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            {/* Primary & Secondary */}
            {education.map((edu, idx) => (
              <div key={idx} className="border border-gray-300 dark:border-[#1e293b] rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{edu.type} School</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 space-y-1.5">
                    <label htmlFor={`edu-school-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">School Name *</label>
                    <input id={`edu-school-${idx}`} type="text" value={edu.school} onChange={(e) => { const u = [...education]; u[idx].school = e.target.value; setEducation(u); }} placeholder="e.g. Town Primary School" title="School Name" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" required />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor={`edu-entry-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">Date of Entry</label>
                    <input id={`edu-entry-${idx}`} type="date" value={edu.entry} onChange={(e) => { const u = [...education]; u[idx].entry = e.target.value; setEducation(u); }} title="Date of Entry" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor={`edu-exit-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">Date of Exit</label>
                    <input id={`edu-exit-${idx}`} type="date" value={edu.exit} onChange={(e) => { const u = [...education]; u[idx].exit = e.target.value; setEducation(u); }} title="Date of Exit" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor={`edu-qual-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">Qualification *</label>
                    <select id={`edu-qual-${idx}`} value={edu.qualification} onChange={(e) => { const u = [...education]; u[idx].qualification = e.target.value; if (e.target.value !== 'Drop Out') u[idx].dropoutGrade = ''; setEducation(u); }} title="Select Qualification" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" required>
                      <option value="">Select</option>
                      <option value={edu.type === 'Primary' ? 'KCPE' : 'KCSE'}>{edu.type === 'Primary' ? 'KCPE' : 'KCSE'}</option>
                      <option value="Drop Out">Drop Out</option>
                    </select>
                  </div>
                  {edu.qualification === 'Drop Out' && (
                    <div className="space-y-1.5">
                      <label htmlFor={`edu-dropout-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">{edu.type === 'Primary' ? 'Grade' : 'Form'} Dropped Out From *</label>
                      {edu.type === 'Primary' ? (
                        <input id={`edu-dropout-${idx}`} type="text" value={edu.dropoutGrade} onChange={(e) => { const u = [...education]; u[idx].dropoutGrade = e.target.value; setEducation(u); }} placeholder="e.g., Grade 6" title="Grade Dropped Out From" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" required />
                      ) : (
                        <select id={`edu-dropout-${idx}`} value={edu.dropoutGrade} onChange={(e) => { const u = [...education]; u[idx].dropoutGrade = e.target.value; setEducation(u); }} title="Form Dropped Out From" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" required>
                          <option value="">Select Form</option>
                          <option value="Form 1">Form 1</option>
                          <option value="Form 2">Form 2</option>
                          <option value="Form 3">Form 3</option>
                          <option value="Form 4">Form 4</option>
                        </select>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Tertiary Education */}
            <div className="border-t border-gray-300 dark:border-[#1e293b] pt-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">College/University</h3>
              {tertiary.map((ter, idx) => (
                <div key={idx} className="border border-gray-300 dark:border-[#1e293b] rounded-lg p-4 mb-3 relative">
                  {tertiary.length > 1 && (
                    <button type="button" onClick={() => setTertiary(tertiary.filter((_, i) => i !== idx))} title="Remove tertiary education entry" aria-label="Remove" className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-lg">✕</button>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor={`ter-inst-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">Institution</label>
                      <input id={`ter-inst-${idx}`} type="text" value={ter.institution} onChange={(e) => { const u = [...tertiary]; u[idx].institution = e.target.value; setTertiary(u); }} placeholder="e.g. University of Nairobi" title="Educational Institution" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor={`ter-course-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">Course</label>
                      <input id={`ter-course-${idx}`} type="text" value={ter.course} onChange={(e) => { const u = [...tertiary]; u[idx].course = e.target.value; setTertiary(u); }} placeholder="e.g. Computer Science" title="Course of Study" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor={`ter-qual-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">Qualification</label>
                      <input id={`ter-qual-${idx}`} type="text" value={ter.qualification} onChange={(e) => { const u = [...tertiary]; u[idx].qualification = e.target.value; setTertiary(u); }} placeholder="e.g., Diploma, Bachelor, Master" title="Academic Qualification" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor={`ter-year-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">Year Completed</label>
                      <input id={`ter-year-${idx}`} type="number" value={ter.year} onChange={(e) => { const u = [...tertiary]; u[idx].year = e.target.value; setTertiary(u); }} min="1950" max={new Date().getFullYear()} placeholder="e.g. 2022" title="Year of Completion" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <label htmlFor={`ter-extra-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">Additional Courses (Optional)</label>
                      <textarea id={`ter-extra-${idx}`} value={ter.additionalCourses} onChange={(e) => { const u = [...tertiary]; u[idx].additionalCourses = e.target.value; setTertiary(u); }} placeholder="List any additional courses or certifications" title="Additional Courses" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm h-20 resize-none" />
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setTertiary([...tertiary, { institution: '', course: '', qualification: '', year: '', additionalCourses: '' }])} className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 text-sm">+ Add Another Diploma/Degree</button>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Provide details of your 2 most recent employers (if applicable)</p>
            {employment.map((emp, idx) => (
              <div key={idx} className="border border-gray-300 dark:border-[#1e293b] rounded-lg p-4 relative">
                {employment.length > 1 && idx > 0 && (
                  <button type="button" onClick={() => setEmployment(employment.filter((_, i) => i !== idx))} title="Remove employment entry" aria-label="Remove" className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-lg">✕</button>
                )}
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Employer {idx + 1}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 space-y-1.5">
                    <label htmlFor={`emp-name-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">Employee Name</label>
                    <input id={`emp-name-${idx}`} type="text" value={emp.employeeName} onChange={(e) => { const u = [...employment]; u[idx].employeeName = e.target.value; setEmployment(u); }} placeholder="Your name as it appeared in company records" title="Your Name in Company Records" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label htmlFor={`emp-comp-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">Company Name</label>
                    <input id={`emp-comp-${idx}`} type="text" value={emp.company} onChange={(e) => { const u = [...employment]; u[idx].company = e.target.value; setEmployment(u); }} placeholder="e.g. Acme Corp" title="Previous Company Name" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor={`emp-join-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">Date Joined</label>
                    <input id={`emp-join-${idx}`} type="date" value={emp.dateJoined} onChange={(e) => { const u = [...employment]; u[idx].dateJoined = e.target.value; setEmployment(u); }} title="Employment Start Date" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor={`emp-left-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">Date Left</label>
                    <input id={`emp-left-${idx}`} type="date" value={emp.dateLeft} onChange={(e) => { const u = [...employment]; u[idx].dateLeft = e.target.value; setEmployment(u); }} title="Employment End Date" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor={`emp-pos-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">Position Held at Time of Leaving</label>
                    <input id={`emp-pos-${idx}`} type="text" value={emp.position} onChange={(e) => { const u = [...employment]; u[idx].position = e.target.value; setEmployment(u); }} placeholder="e.g. Lead Guard" title="Job Position Held" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor={`emp-reason-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">Reason for Leaving</label>
                    <input id={`emp-reason-${idx}`} type="text" value={emp.reasonLeaving} onChange={(e) => { const u = [...employment]; u[idx].reasonLeaving = e.target.value; setEmployment(u); }} placeholder="e.g. Career Change" title="Reason for Leaving Previous Employment" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                  </div>
                  <div className="md:col-span-2 border-t border-gray-200 dark:border-[#1e293b] pt-3 mt-2">
                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">Reference Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor={`emp-ref-first-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">First Name</label>
                        <input id={`emp-ref-first-${idx}`} type="text" value={emp.refFirstName} onChange={(e) => { const u = [...employment]; u[idx].refFirstName = e.target.value; setEmployment(u); }} placeholder="e.g. John" title="Reference First Name" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor={`emp-ref-sec-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">Second Name</label>
                        <input id={`emp-ref-sec-${idx}`} type="text" value={emp.refSecondName} onChange={(e) => { const u = [...employment]; u[idx].refSecondName = e.target.value; setEmployment(u); }} placeholder="e.g. Doe" title="Reference Second Name" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor={`emp-ref-last-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">Last Name</label>
                        <input id={`emp-ref-last-${idx}`} type="text" value={emp.refLastName} onChange={(e) => { const u = [...employment]; u[idx].refLastName = e.target.value; setEmployment(u); }} placeholder="e.g. Smith" title="Reference Last Name" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor={`emp-ref-id-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">ID/Passport</label>
                        <input id={`emp-ref-id-${idx}`} type="text" value={emp.refId} onChange={(e) => { const u = [...employment]; u[idx].refId = e.target.value; setEmployment(u); }} placeholder="e.g. 12345678" title="Reference ID/Passport Number" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor={`emp-ref-email-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">Email</label>
                        <input id={`emp-ref-email-${idx}`} type="email" value={emp.refEmail} onChange={(e) => { const u = [...employment]; u[idx].refEmail = e.target.value; setEmployment(u); }} placeholder="e.g. john.smith@example.com" title="Reference Email" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor={`emp-ref-rel-${idx}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">Relationship</label>
                        <input id={`emp-ref-rel-${idx}`} type="text" value={emp.refRelationship} onChange={(e) => { const u = [...employment]; u[idx].refRelationship = e.target.value; setEmployment(u); }} placeholder="e.g., Supervisor" title="Reference Relationship" className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {employment.length < 2 && (
              <button type="button" onClick={() => setEmployment([...employment, { employeeName: '', company: '', dateJoined: '', dateLeft: '', position: '', reasonLeaving: '', refFirstName: '', refSecondName: '', refLastName: '', refId: '', refEmail: '', refRelationship: '' }])} className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 text-sm">+ Add Another Employer</button>
            )}
          </div>
        );
      case 5:
        return (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="chronic-cond" className="text-xs font-medium text-gray-700 dark:text-gray-300">Chronic Condition</label>
              <select
                id="chronic-cond"
                value={formData.chronicCondition}
                onChange={(e) => {
                  handleInputChange('chronicCondition', e.target.value);
                  if (e.target.value !== 'Other') handleInputChange('chronicConditionOther', '');
                }}
                title="Select Chronic Condition"
                className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              >
                <option value="">Select</option>
                <option value="None">None</option>
                <option value="Allergies">Allergies</option>
                <option value="Asthma">Asthma</option>
                <option value="Diabetes">Diabetes</option>
                <option value="Hypertension">Hypertension</option>
                <option value="Other">Other</option>
              </select>
            </div>
            {formData.chronicCondition === 'Other' && (
              <div className="space-y-1.5">
                <label htmlFor="chronic-cond-other" className="text-xs font-medium text-gray-700 dark:text-gray-300">Specify Condition *</label>
                <input
                  id="chronic-cond-other"
                  type="text"
                  value={formData.chronicConditionOther}
                  onChange={(e) => handleInputChange('chronicConditionOther', e.target.value)}
                  placeholder="Please specify the condition"
                  title="Specify Other Chronic Condition"
                  className="w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  required
                />
              </div>
            )}
            <InputField label="Medical Notes" field="medicalNotes" type="textarea" placeholder="Additional health information..." formData={formData} errors={errors} onChange={handleInputChange} />
            <label className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-[#0A1628] rounded-lg cursor-pointer border border-gray-200 dark:border-[#1e293b]">
              <input
                type="checkbox"
                checked={formData.consentGiven}
                onChange={(e) => handleInputChange('consentGiven', e.target.checked)}
                className="mt-0.5 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">I declare all information is accurate and complete</span>
            </label>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="hr-add-employee-page min-h-screen bg-slate-50 dark:bg-dark-surface">
      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-dark-surface/90">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Confirm Employee Creation</h3>
            <div className="space-y-3 mb-6">
              <div className="bg-gray-50 dark:bg-[#0A1628] p-4 rounded-lg border border-gray-200 dark:border-[#1e293b]">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Generated Credentials</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Username:</span>
                    <span className="text-sm font-mono font-semibold text-gray-900 dark:text-white">{credentials.username}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Password:</span>
                    <span className="text-sm font-mono font-semibold text-gray-900 dark:text-white">{credentials.password}</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Email will be sent to: <span className="font-semibold text-gray-900 dark:text-white">{formData.email || 'No email provided'}</span>
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-purple/30 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndCreate}
                className="flex-1 rounded-2xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-pink"
              >
                Create Employee
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl space-y-6 p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/app/hr/dashboard')} 
            className="rounded-full border border-slate-200 bg-white p-2 shadow-sm transition hover:border-brand-purple/30 hover:text-brand-purple dark:border-white/10 dark:bg-white/[0.04]"
            title="Back to HR Dashboard"
            aria-label="Back"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-brand-purple">Add Employee</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">Add New Employee</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Step {currentSection + 1} of {sections.length}</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-dark-surface/90">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {sections.map((section, idx) => {
              const Icon = section.icon;
              const isActive = idx === currentSection;
              const isCompleted = idx < currentSection;
              
              return (
                <button
                  key={idx}
                  onClick={() => setCurrentSection(idx)}
                  title={section.title}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-500/10 border-2 border-blue-500'
                      : isCompleted
                      ? 'bg-green-50 dark:bg-green-500/10 border border-green-500/30 hover:border-green-500'
                      : 'border border-gray-200 dark:border-[#1e293b] hover:border-gray-300 dark:hover:border-[#334155]'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isActive
                      ? 'bg-blue-500 text-white'
                      : isCompleted
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 dark:bg-[#1e293b] text-gray-400'
                  }`}>
                    {isCompleted ? <CheckCircle2 size={20} /> : <Icon size={20} />}
                  </div>
                  <span className={`text-xs font-medium text-center ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : isCompleted
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {section.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Content */}
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-dark-surface/90">
          <h2 className="mb-6 text-lg font-black tracking-tight text-slate-900 dark:text-white">{sections[currentSection].title}</h2>
          {renderSection()}

          {/* Error Message */}
          {errors.submit && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              <AlertCircle size={16} />
              {errors.submit}
            </div>
          )}

          {/* Navigation Buttons */}
            <div className="mt-8 flex justify-between border-t border-slate-200 pt-6 dark:border-white/10">
            <button
              onClick={() => setCurrentSection(Math.max(0, currentSection - 1))}
              disabled={currentSection === 0}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-[#334155] rounded-lg hover:bg-gray-50 dark:hover:bg-[#1e293b] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            
            {currentSection === sections.length - 1 ? (
              <button
                onClick={handleSubmit}
                disabled={!formData.consentGiven || isSubmitting}
                className="flex items-center gap-2 rounded-2xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-pink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Add Employee'
                )}
              </button>
            ) : (
              <button 
                onClick={handleNext} 
                className="rounded-2xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-pink"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddEmployee;
