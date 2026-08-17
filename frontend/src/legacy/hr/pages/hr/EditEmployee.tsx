// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CreditCard,
  GraduationCap,
  Heart,
  Loader2,
  Save,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import CustomLoader from '../../components/CustomLoader';
import Toast from '../../components/Toast';
import { formatPhoneInput, normalizePhoneNumber } from '../../utils/phoneNumbers';

interface EmployeeRecord {
  first_name: string;
  second_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  id_number: string;
  date_of_birth: string;
  gender: string;
  marital_status: string;
  religion: string;
  department: string;
  designation: string;
  role: string;
  employment_type: string;
  employment_start_date: string;
  employee_no?: string | null;
  salary: string;
  nssf: string;
  sha: string;
  kra_pin: string;
  original_home: string;
  current_residence: string;
  bank_name: string;
  bank_branch: string;
  branch_code: string;
  account_number: string;
  module: string;
  employee_form_data?: Record<string, any> | null;
  statutory_deductions?: string[] | null;
  pwd_status?: boolean | null;
  chronic_condition?: string | null;
  medical_notes?: string | null;
  dependants?: Array<Record<string, any>> | null;
  education?: Array<Record<string, any>> | null;
  employment_history?: Array<Record<string, any>> | null;
}

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

const createNextOfKin = (): NextOfKin => ({
  name: '',
  relationship: '',
  phone: formatPhoneInput(''),
  email: '',
  address: '',
});

const createEducation = (type: string): Education => ({
  type,
  school: '',
  entry: '',
  exit: '',
  qualification: '',
  dropoutGrade: '',
});

const createTertiary = (): Tertiary => ({
  institution: '',
  course: '',
  qualification: '',
  year: '',
  additionalCourses: '',
});

const createEmployment = (): Employment => ({
  employeeName: '',
  company: '',
  dateJoined: '',
  dateLeft: '',
  position: '',
  reasonLeaving: '',
  refFirstName: '',
  refSecondName: '',
  refLastName: '',
  refId: '',
  refEmail: '',
  refRelationship: '',
});

const asString = (value: unknown) => (typeof value === 'string' ? value : value == null ? '' : String(value));

const EditEmployee: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [currentSection, setCurrentSection] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<EmployeeRecord>({
    first_name: '',
    second_name: '',
    last_name: '',
    full_name: '',
    email: '',
    phone: formatPhoneInput(''),
    id_number: '',
    date_of_birth: '',
    gender: '',
    marital_status: '',
    religion: '',
    department: '',
    designation: '',
    role: '',
    employment_type: '',
    employment_start_date: '',
    employee_no: '',
    salary: '',
    nssf: '',
    sha: '',
    kra_pin: '',
    original_home: '',
    current_residence: '',
    bank_name: '',
    bank_branch: '',
    branch_code: '',
    account_number: '',
    module: '',
    employee_form_data: {},
    statutory_deductions: [],
    pwd_status: null,
    chronic_condition: '',
    medical_notes: '',
    dependants: [],
    education: [],
    employment_history: [],
  });
  const [dependants, setDependants] = useState<NextOfKin[]>([createNextOfKin()]);
  const [education, setEducation] = useState<Education[]>([createEducation('Primary'), createEducation('Secondary')]);
  const [tertiary, setTertiary] = useState<Tertiary[]>([createTertiary()]);
  const [employment, setEmployment] = useState<Employment[]>([createEmployment()]);
  const [originalEmail, setOriginalEmail] = useState('');

  const sections = useMemo(
    () => [
      { title: 'Primary Details', icon: User },
      { title: 'Bank Information', icon: CreditCard },
      { title: 'Next of Kin & Dependants', icon: Heart },
      { title: 'Education & Qualifications', icon: GraduationCap },
      { title: 'Employment History', icon: Briefcase },
      { title: 'Medical & Consent', icon: Building2 },
    ],
    [],
  );

  useEffect(() => {
    if (!id) return;

    const fetchEmployee = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select(
            'full_name, first_name, second_name, last_name, email, phone, phone_number, id_number, date_of_birth, gender, marital_status, religion, role, employment_type, employment_start_date, employee_no, salary, nssf, sha, kra_pin, original_home, current_residence, bank_name, bank_branch, branch_code, account_number, module, employee_form_data, statutory_deductions, pwd_status, chronic_condition, medical_notes, dependants, education, employment_history, department, designation',
          )
          .eq('id', id)
          .single();

        if (error) throw error;

        const raw = (data?.employee_form_data ?? {}) as Record<string, any>;
        const source = { ...raw };

        const nextForm: EmployeeRecord = {
          first_name: asString(data?.first_name ?? source.firstName),
          second_name: asString(data?.second_name ?? source.secondName),
          last_name: asString(data?.last_name ?? source.lastName),
          full_name: asString(data?.full_name ?? source.fullName),
          email: asString(data?.email ?? source.email),
          phone: formatPhoneInput(asString(data?.phone_number ?? data?.phone ?? source.phoneNumber)),
          id_number: asString(data?.id_number ?? source.idNumber),
          date_of_birth: asString(data?.date_of_birth ?? source.dateOfBirth),
          gender: asString(data?.gender ?? source.gender),
          marital_status: asString(data?.marital_status ?? source.maritalStatus),
          religion: asString(data?.religion ?? source.religion),
          department: asString(data?.department ?? source.department),
          designation: asString(data?.designation ?? source.designation),
          role: asString(data?.role ?? source.role),
          employment_type: asString(data?.employment_type ?? source.employmentType),
          employment_start_date: asString(data?.employment_start_date ?? source.employmentStartDate),
          employee_no: asString(data?.employee_no ?? source.employeeNo) || null,
          salary: data?.salary != null ? String(data.salary) : asString(source.salary),
          nssf: asString(data?.nssf ?? source.nssf),
          sha: asString(data?.sha ?? source.sha),
          kra_pin: asString(data?.kra_pin ?? source.kraPin),
          original_home: asString(data?.original_home ?? source.originalHome),
          current_residence: asString(data?.current_residence ?? source.currentResidence),
          bank_name: asString(data?.bank_name ?? source.bankName),
          bank_branch: asString(data?.bank_branch ?? source.bankBranch),
          branch_code: asString(data?.branch_code ?? source.branchCode),
          account_number: asString(data?.account_number ?? source.accountNumber),
          module: asString(data?.module ?? source.module),
          employee_form_data: raw,
          statutory_deductions: Array.isArray(data?.statutory_deductions) ? data.statutory_deductions : [],
          pwd_status: typeof data?.pwd_status === 'boolean' ? data.pwd_status : null,
          chronic_condition: asString(data?.chronic_condition ?? source.chronicCondition),
          medical_notes: asString(data?.medical_notes ?? source.medicalNotes),
          dependants: Array.isArray(data?.dependants) ? data.dependants : [],
          education: Array.isArray(data?.education) ? data.education : [],
          employment_history: Array.isArray(data?.employment_history) ? data.employment_history : [],
        };

        setForm(nextForm);
        setOriginalEmail(asString(data?.email ?? source.email));

        const nextDependants = Array.isArray(data?.dependants) && data.dependants.length > 0
          ? data.dependants.map((entry: any) => ({
              name: asString(entry?.name),
              relationship: asString(entry?.relationship),
              phone: formatPhoneInput(asString(entry?.phone)),
              email: asString(entry?.email),
              address: asString(entry?.address),
            }))
          : [createNextOfKin()];
        setDependants(nextDependants);

        const nextEducation = Array.isArray(data?.education) && data.education.length > 0
          ? data.education
              .filter((entry: any) => entry?.type === 'Primary' || entry?.type === 'Secondary')
              .map((entry: any) => ({
                type: asString(entry?.type),
                school: asString(entry?.school),
                entry: asString(entry?.entry),
                exit: asString(entry?.exit),
                qualification: asString(entry?.qualification),
                dropoutGrade: asString(entry?.dropoutGrade),
              }))
          : [createEducation('Primary'), createEducation('Secondary')];
        setEducation(nextEducation.length > 0 ? nextEducation : [createEducation('Primary'), createEducation('Secondary')]);

        const nextTertiary = Array.isArray(data?.education)
          ? data.education
              .filter((entry: any) => entry?.type && entry.type !== 'Primary' && entry.type !== 'Secondary')
              .map((entry: any) => ({
                institution: asString(entry?.institution ?? entry?.school),
                course: asString(entry?.course ?? entry?.qualification),
                qualification: asString(entry?.qualification),
                year: asString(entry?.year),
                additionalCourses: asString(entry?.additionalCourses),
              }))
          : [];
        setTertiary(nextTertiary.length > 0 ? nextTertiary : [createTertiary()]);

        const nextEmployment = Array.isArray(data?.employment_history) && data.employment_history.length > 0
          ? data.employment_history.map((entry: any) => ({
              employeeName: asString(entry?.employeeName),
              company: asString(entry?.company),
              dateJoined: asString(entry?.dateJoined),
              dateLeft: asString(entry?.dateLeft),
              position: asString(entry?.position),
              reasonLeaving: asString(entry?.reasonLeaving),
              refFirstName: asString(entry?.refFirstName),
              refSecondName: asString(entry?.refSecondName),
              refLastName: asString(entry?.refLastName),
              refId: asString(entry?.refId),
              refEmail: asString(entry?.refEmail),
              refRelationship: asString(entry?.refRelationship),
            }))
          : [createEmployment()];
        setEmployment(nextEmployment.length > 0 ? nextEmployment : [createEmployment()]);
      } catch (err: any) {
        console.error('Failed to load employee profile:', err);
        setToast({ message: err.message || 'Failed to load employee profile', type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchEmployee();
  }, [id]);

  const updateField = (field: keyof EmployeeRecord, value: string | boolean | null | undefined) => {
    setForm((prev) => ({ ...prev, [field]: value as any }));
  };

  const validatePhone = (phone: string) => /^(\+254|0)[17]\d{8}$/.test(phone);
  const validateID = (value: string) => /^\d{7,8}$/.test(value);

  const validateSection = (section: number): boolean => {
    const nextErrors: Record<string, string> = {};

    if (section === 0) {
      if (!form.first_name.trim()) nextErrors.first_name = 'First name is required';
      if (!form.last_name.trim()) nextErrors.last_name = 'Last name is required';
      if (!form.id_number.trim()) nextErrors.id_number = 'ID number is required';
      else if (!validateID(form.id_number.trim())) nextErrors.id_number = 'Use 7 or 8 digits';
      if (!form.gender.trim()) nextErrors.gender = 'Gender is required';
      if (!form.department.trim()) nextErrors.department = 'Department is required';
      if (!form.designation.trim()) nextErrors.designation = 'Designation is required';
      if (!form.employment_type.trim()) nextErrors.employment_type = 'Employment type is required';
      if (!form.email.trim()) nextErrors.email = 'Email is required';
      if (!validatePhone(form.phone)) nextErrors.phone = 'Use a valid Kenyan phone number';
    }

    if (section === 1) {
      if (!form.bank_name.trim()) nextErrors.bank_name = 'Bank name is required';
      if (!form.account_number.trim()) nextErrors.account_number = 'Account number is required';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const isSectionComplete = (section: number) => {
    if (section === 0) {
      return Boolean(
        form.first_name.trim() &&
        form.last_name.trim() &&
        form.id_number.trim() &&
        validateID(form.id_number.trim()) &&
        form.gender.trim() &&
        form.department.trim() &&
        form.designation.trim() &&
        form.employment_type.trim() &&
        form.email.trim() &&
        validatePhone(form.phone)
      );
    }

    if (section === 1) {
      return Boolean(form.bank_name.trim() && form.account_number.trim());
    }

    if (section === 2) {
      return dependants.some((entry) => entry.name.trim() || entry.phone.trim() || entry.relationship.trim() || entry.email.trim() || entry.address.trim());
    }

    if (section === 3) {
      return Boolean(education.some((entry) => entry.school.trim()) || tertiary.some((entry) => entry.institution.trim()));
    }

    if (section === 4) {
      return Boolean(employment.some((entry) => entry.company.trim() || entry.employeeName.trim()));
    }

    if (section === 5) {
      return Boolean(form.medical_notes?.trim() || form.chronic_condition?.trim() || form.pwd_status !== null);
    }

    return false;
  };

  const saveEmployee = async () => {
    if (!id) return;
      setSaving(true);
      try {
      if (!validateSection(currentSection)) {
        setSaving(false);
        return;
      }
        const fullNameComputed = [form.first_name, form.second_name, form.last_name]
          .map((part) => part.trim())
          .filter(Boolean)
        .join(' ')
        .trim();

      const { data: { user } } = await supabase.auth.getUser();
      const currentEmail = form.email.trim();
      const previousEmail = originalEmail.trim();
      const emailChanged = Boolean(currentEmail && currentEmail !== previousEmail);

      if (emailChanged) {
        const { error: authSyncError } = await supabase.functions.invoke('sync-employee-auth-email', {
          body: {
            userId: id,
            email: currentEmail,
            fullName: fullNameComputed || form.full_name.trim() || null,
            updatedBy: user?.id ?? null,
          },
        });

        if (authSyncError) {
          throw new Error(authSyncError.message || 'Failed to update the login email in Supabase Auth.');
        }
      }

      const profilePayload = {
        full_name: fullNameComputed || form.full_name.trim() || null,
        first_name: form.first_name.trim() || null,
        second_name: form.second_name.trim() || null,
        last_name: form.last_name.trim() || null,
        email: form.email.trim() || null,
        phone: normalizePhoneNumber(form.phone),
        phone_number: normalizePhoneNumber(form.phone),
        id_number: form.id_number.trim() || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        marital_status: form.marital_status || null,
        religion: form.religion || null,
        department: form.department || null,
        designation: form.designation || null,
        role: form.role.trim() || null,
        employment_type: form.employment_type.trim() || null,
        employment_start_date: form.employment_start_date || null,
        salary: form.salary ? Number(form.salary) : null,
        nssf: form.nssf.trim() || null,
        sha: form.sha.trim() || null,
        kra_pin: form.kra_pin.trim() || null,
        original_home: form.original_home.trim() || null,
        current_residence: form.current_residence.trim() || null,
        bank_name: form.bank_name.trim() || null,
        bank_branch: form.bank_branch.trim() || null,
        branch_code: form.branch_code.trim() || null,
        account_number: form.account_number.trim() || null,
        module: form.module.trim() || null,
        pwd_status: form.pwd_status,
        chronic_condition: form.chronic_condition?.trim() || null,
        medical_notes: form.medical_notes?.trim() || null,
        statutory_deductions: form.statutory_deductions ?? [],
        dependants: dependants
          .map((entry) => ({
            ...entry,
            phone: normalizePhoneNumber(entry.phone) || '',
          }))
          .filter((entry) => entry.name.trim() || entry.phone.trim() || entry.relationship.trim() || entry.email.trim() || entry.address.trim()),
        education: [
          ...education,
          ...tertiary.map((entry) => ({
            type: 'Tertiary',
            institution: entry.institution,
            course: entry.course,
            qualification: entry.qualification,
            year: entry.year,
            additionalCourses: entry.additionalCourses,
          })),
        ],
        employment_history: employment,
        employee_form_data: {
          ...((form.employee_form_data ?? {}) as Record<string, any>),
          ...form,
          dependants,
          education,
          tertiary,
          employment,
        },
      };

      const { error } = await supabase.from('profiles').update(profilePayload).eq('id', id);
      if (error) throw error;

      setOriginalEmail(currentEmail);

        setToast({ message: 'Employee updated successfully', type: 'success' });
        setErrors({});
      } catch (err: any) {
      console.error('Failed to update employee:', err);
      setToast({ message: err.message || 'Failed to update employee', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 dark:text-white';
  const labelCls = 'block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-surface">
        <CustomLoader size={40} label="Loading employee profile..." />
      </div>
    );
  }

  const renderSection = () => {
    switch (currentSection) {
      case 0:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Employee No</label>
              <input value={form.employee_no || ''} readOnly className={inputCls + ' bg-gray-100 dark:bg-[#0A1628] cursor-not-allowed'} />
            </div>
            <div>
              <label className={labelCls}>First Name</label>
              <input value={form.first_name} onChange={(e) => updateField('first_name', e.target.value)} className={inputCls} />
              {errors.first_name && <p className="mt-1 text-xs text-red-500">{errors.first_name}</p>}
            </div>
            <div>
              <label className={labelCls}>Second Name</label>
              <input value={form.second_name} onChange={(e) => updateField('second_name', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Last Name</label>
              <input value={form.last_name} onChange={(e) => updateField('last_name', e.target.value)} className={inputCls} />
              {errors.last_name && <p className="mt-1 text-xs text-red-500">{errors.last_name}</p>}
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} className={inputCls} />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input value={form.phone} onChange={(e) => updateField('phone', formatPhoneInput(e.target.value))} className={inputCls} />
              {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
            </div>
            <div>
              <label className={labelCls}>ID Number</label>
              <input value={form.id_number} onChange={(e) => updateField('id_number', e.target.value)} className={inputCls} />
              {errors.id_number && <p className="mt-1 text-xs text-red-500">{errors.id_number}</p>}
            </div>
            <div>
              <label className={labelCls}>Date of Birth</label>
              <input type="date" value={form.date_of_birth ? String(form.date_of_birth).slice(0, 10) : ''} onChange={(e) => updateField('date_of_birth', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Gender</label>
              <input value={form.gender} onChange={(e) => updateField('gender', e.target.value)} className={inputCls} />
              {errors.gender && <p className="mt-1 text-xs text-red-500">{errors.gender}</p>}
            </div>
            <div>
              <label className={labelCls}>Marital Status</label>
              <input value={form.marital_status} onChange={(e) => updateField('marital_status', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Religion</label>
              <input value={form.religion} onChange={(e) => updateField('religion', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Department</label>
              <input value={form.department} onChange={(e) => updateField('department', e.target.value)} className={inputCls} />
              {errors.department && <p className="mt-1 text-xs text-red-500">{errors.department}</p>}
            </div>
            <div>
              <label className={labelCls}>Designation</label>
              <input value={form.designation} onChange={(e) => updateField('designation', e.target.value)} className={inputCls} />
              {errors.designation && <p className="mt-1 text-xs text-red-500">{errors.designation}</p>}
            </div>
            <div>
              <label className={labelCls}>Role</label>
              <input value={form.role} onChange={(e) => updateField('role', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Employment Type</label>
              <input value={form.employment_type} onChange={(e) => updateField('employment_type', e.target.value)} className={inputCls} />
              {errors.employment_type && <p className="mt-1 text-xs text-red-500">{errors.employment_type}</p>}
            </div>
            <div>
              <label className={labelCls}>Start Date</label>
              <input type="date" value={form.employment_start_date ? String(form.employment_start_date).slice(0, 10) : ''} onChange={(e) => updateField('employment_start_date', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Salary</label>
              <input type="number" value={form.salary} onChange={(e) => updateField('salary', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>NSSF</label>
              <input value={form.nssf} onChange={(e) => updateField('nssf', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>SHA</label>
              <input value={form.sha} onChange={(e) => updateField('sha', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>KRA PIN</label>
              <input value={form.kra_pin} onChange={(e) => updateField('kra_pin', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Original Home</label>
              <input value={form.original_home} onChange={(e) => updateField('original_home', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Current Residence</label>
              <input value={form.current_residence} onChange={(e) => updateField('current_residence', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Module</label>
              <input value={form.module} onChange={(e) => updateField('module', e.target.value)} className={inputCls} />
            </div>
          </div>
        );
      case 1:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Bank Name</label>
              <input value={form.bank_name} onChange={(e) => updateField('bank_name', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Bank Branch</label>
              <input value={form.bank_branch} onChange={(e) => updateField('bank_branch', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Branch Code</label>
              <input value={form.branch_code} onChange={(e) => updateField('branch_code', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Account Number</label>
              <input value={form.account_number} onChange={(e) => updateField('account_number', e.target.value)} className={inputCls} />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            {dependants.map((entry, index) => (
              <div key={`dep-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-[#1e293b] dark:bg-[#08111f] space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Name</label>
                    <input value={entry.name} onChange={(e) => setDependants((cur) => cur.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Relationship</label>
                    <input value={entry.relationship} onChange={(e) => setDependants((cur) => cur.map((item, i) => i === index ? { ...item, relationship: e.target.value } : item))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Phone</label>
                    <input value={entry.phone} onChange={(e) => setDependants((cur) => cur.map((item, i) => i === index ? { ...item, phone: formatPhoneInput(e.target.value) } : item))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Email</label>
                    <input type="email" value={entry.email} onChange={(e) => setDependants((cur) => cur.map((item, i) => i === index ? { ...item, email: e.target.value } : item))} className={inputCls} />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>Address</label>
                    <input value={entry.address} onChange={(e) => setDependants((cur) => cur.map((item, i) => i === index ? { ...item, address: e.target.value } : item))} className={inputCls} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            {education.map((entry, index) => (
              <div key={`edu-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-[#1e293b] dark:bg-[#08111f] space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Type</label>
                    <input value={entry.type} readOnly className={inputCls + ' bg-gray-100 dark:bg-[#0A1628] cursor-not-allowed'} />
                  </div>
                  <div>
                    <label className={labelCls}>School</label>
                    <input value={entry.school} onChange={(e) => setEducation((cur) => cur.map((item, i) => i === index ? { ...item, school: e.target.value } : item))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Entry Date</label>
                    <input type="date" value={entry.entry} onChange={(e) => setEducation((cur) => cur.map((item, i) => i === index ? { ...item, entry: e.target.value } : item))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Exit Date</label>
                    <input type="date" value={entry.exit} onChange={(e) => setEducation((cur) => cur.map((item, i) => i === index ? { ...item, exit: e.target.value } : item))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Qualification</label>
                    <input value={entry.qualification} onChange={(e) => setEducation((cur) => cur.map((item, i) => i === index ? { ...item, qualification: e.target.value } : item))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Dropout Grade</label>
                    <input value={entry.dropoutGrade} onChange={(e) => setEducation((cur) => cur.map((item, i) => i === index ? { ...item, dropoutGrade: e.target.value } : item))} className={inputCls} />
                  </div>
                </div>
              </div>
            ))}
            <div className="space-y-4 pt-2">
              {tertiary.map((entry, index) => (
                <div key={`ter-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-[#1e293b] dark:bg-[#08111f] space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Institution</label>
                      <input value={entry.institution} onChange={(e) => setTertiary((cur) => cur.map((item, i) => i === index ? { ...item, institution: e.target.value } : item))} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Course</label>
                      <input value={entry.course} onChange={(e) => setTertiary((cur) => cur.map((item, i) => i === index ? { ...item, course: e.target.value } : item))} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Qualification</label>
                      <input value={entry.qualification} onChange={(e) => setTertiary((cur) => cur.map((item, i) => i === index ? { ...item, qualification: e.target.value } : item))} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Year</label>
                      <input value={entry.year} onChange={(e) => setTertiary((cur) => cur.map((item, i) => i === index ? { ...item, year: e.target.value } : item))} className={inputCls} />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelCls}>Additional Courses</label>
                      <textarea value={entry.additionalCourses} onChange={(e) => setTertiary((cur) => cur.map((item, i) => i === index ? { ...item, additionalCourses: e.target.value } : item))} className={inputCls + ' h-24'} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            {employment.map((entry, index) => (
              <div key={`emp-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-[#1e293b] dark:bg-[#08111f] space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Employee Name</label>
                    <input value={entry.employeeName} onChange={(e) => setEmployment((cur) => cur.map((item, i) => i === index ? { ...item, employeeName: e.target.value } : item))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Company</label>
                    <input value={entry.company} onChange={(e) => setEmployment((cur) => cur.map((item, i) => i === index ? { ...item, company: e.target.value } : item))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Date Joined</label>
                    <input type="date" value={entry.dateJoined} onChange={(e) => setEmployment((cur) => cur.map((item, i) => i === index ? { ...item, dateJoined: e.target.value } : item))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Date Left</label>
                    <input type="date" value={entry.dateLeft} onChange={(e) => setEmployment((cur) => cur.map((item, i) => i === index ? { ...item, dateLeft: e.target.value } : item))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Position</label>
                    <input value={entry.position} onChange={(e) => setEmployment((cur) => cur.map((item, i) => i === index ? { ...item, position: e.target.value } : item))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Reason for Leaving</label>
                    <input value={entry.reasonLeaving} onChange={(e) => setEmployment((cur) => cur.map((item, i) => i === index ? { ...item, reasonLeaving: e.target.value } : item))} className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Reference First Name</label>
                    <input value={entry.refFirstName} onChange={(e) => setEmployment((cur) => cur.map((item, i) => i === index ? { ...item, refFirstName: e.target.value } : item))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Reference Second Name</label>
                    <input value={entry.refSecondName} onChange={(e) => setEmployment((cur) => cur.map((item, i) => i === index ? { ...item, refSecondName: e.target.value } : item))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Reference Last Name</label>
                    <input value={entry.refLastName} onChange={(e) => setEmployment((cur) => cur.map((item, i) => i === index ? { ...item, refLastName: e.target.value } : item))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Reference ID</label>
                    <input value={entry.refId} onChange={(e) => setEmployment((cur) => cur.map((item, i) => i === index ? { ...item, refId: e.target.value } : item))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Reference Email</label>
                    <input type="email" value={entry.refEmail} onChange={(e) => setEmployment((cur) => cur.map((item, i) => i === index ? { ...item, refEmail: e.target.value } : item))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Reference Relationship</label>
                    <input value={entry.refRelationship} onChange={(e) => setEmployment((cur) => cur.map((item, i) => i === index ? { ...item, refRelationship: e.target.value } : item))} className={inputCls} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      case 5:
        return (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>PWD Status</label>
              <select value={form.pwd_status ? 'Yes' : 'No'} onChange={(e) => updateField('pwd_status', e.target.value === 'Yes')} className={inputCls}>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Chronic Condition</label>
              <input value={form.chronic_condition || ''} onChange={(e) => updateField('chronic_condition', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Medical Notes</label>
              <textarea value={form.medical_notes || ''} onChange={(e) => updateField('medical_notes', e.target.value)} className={inputCls + ' h-28'} />
            </div>
            <div>
              <label className={labelCls}>Statutory Deductions</label>
              <textarea
                value={(form.statutory_deductions || []).join(', ')}
                onChange={(e) => updateField('statutory_deductions', e.target.value.split(',').map((item) => item.trim()).filter(Boolean) as any)}
                className={inputCls + ' h-24'}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 dark:bg-dark-surface lg:p-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="rounded-full border border-slate-200 bg-white p-2 shadow-sm transition hover:border-brand-purple/30 hover:text-brand-purple dark:border-white/10 dark:bg-white/[0.04]"
            title="Back"
            aria-label="Back"
          >
            <ArrowLeft size={18} className="text-gray-600 dark:text-gray-300" />
          </button>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-brand-purple">Employee Record</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">Edit Employee</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Step {currentSection + 1} of {sections.length}</p>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-dark-surface/90">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {sections.map((section, idx) => {
              const Icon = section.icon;
              const isActive = idx === currentSection;
              const isCompleted = idx < currentSection;
              return (
                <button
                  key={section.title}
                  onClick={() => setCurrentSection(idx)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-500/10 border-2 border-blue-500'
                      : isCompleted
                        ? 'bg-green-50 dark:bg-green-500/10 border border-green-500/30 hover:border-green-500'
                        : 'border border-gray-200 dark:border-[#1e293b] hover:border-gray-300 dark:hover:border-[#334155]'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isActive ? 'bg-blue-500 text-white' : isCompleted ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-[#1e293b] text-gray-400'
                  }`}>
                    {isCompleted ? <ShieldCheck size={20} /> : <Icon size={20} />}
                  </div>
                  <span className={`text-xs font-medium text-center ${
                    isActive ? 'text-blue-600 dark:text-blue-400' : isCompleted ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {section.title}
                    {isSectionComplete(idx) && <span className="block text-[10px] uppercase tracking-[0.18em] text-green-600 dark:text-green-400">Complete</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-dark-surface/90">
          <h2 className="mb-6 text-lg font-black tracking-tight text-slate-900 dark:text-white">{sections[currentSection].title}</h2>
          {renderSection()}

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
                onClick={saveEmployee}
                disabled={saving}
                className="flex items-center gap-2 rounded-2xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-pink disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            ) : (
              <button
                onClick={() => {
                  if (validateSection(currentSection)) {
                    setCurrentSection(Math.min(sections.length - 1, currentSection + 1));
                  }
                }}
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

export default EditEmployee;
