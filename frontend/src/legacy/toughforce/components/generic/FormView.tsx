// @ts-nocheck
import React, { useState } from 'react';
import { Save } from 'lucide-react';

interface FormViewProps {
    title: string;
    fields: { label: string; type: string; placeholder?: string; options?: (string | { value: string; label: string })[] }[];
    onSave: (data: any) => void;
}

const FormView: React.FC<FormViewProps> = ({ title, fields, onSave }) => {
    const [formData, setFormData] = useState<any>({});

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-up">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Fill in the details below to proceed.</p>
            </div>
            <div className="bg-white dark:bg-dark-surface p-8 rounded-2xl border border-gray-200 dark:border-white/10 shadow-lg">
                <form className="space-y-5" onSubmit={handleSubmit}>
                    {fields.map((field, i) => {
                        const fieldId = `field-${field.label.toLowerCase().replace(/\s+/g, '-')}-${i}`;
                        return (
                            <div key={i} className="space-y-1.5">
                                <label htmlFor={fieldId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {field.label}
                                </label>
                                {field.type === 'textarea' ? (
                                    <textarea
                                        id={fieldId}
                                        title={field.label}
                                        placeholder={field.placeholder}
                                        onChange={(e) => setFormData({ ...formData, [field.label]: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-3 outline-none focus:border-brand-purple transition"
                                        rows={4}
                                    />
                                ) : field.type === 'select' ? (
                                    <select
                                        id={fieldId}
                                        title={field.label}
                                        onChange={(e) => setFormData({ ...formData, [field.label]: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-3 outline-none focus:border-brand-purple transition"
                                    >
                                        <option value="">{field.placeholder || 'Select an option'}</option>
                                        {field.options?.map((opt) => {
                                            const value = typeof opt === 'string' ? opt : opt.value;
                                            const label = typeof opt === 'string' ? opt : opt.label;
                                            return <option key={value} value={value}>{label}</option>;
                                        })}
                                    </select>
                                ) : (
                                    <input
                                        id={fieldId}
                                        type={field.type}
                                        title={field.label}
                                        placeholder={field.placeholder}
                                        onChange={(e) => setFormData({ ...formData, [field.label]: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-3 outline-none focus:border-brand-purple transition"
                                    />
                                )}
                            </div>
                        );
                    })}
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" className="px-5 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5">Cancel</button>
                        <button type="submit" className="px-5 py-2.5 rounded-lg bg-brand-purple text-white font-medium hover:bg-brand-pink transition flex items-center gap-2 shadow-lg shadow-brand-purple/20">
                            <Save size={18} /> Save Record
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default FormView;
