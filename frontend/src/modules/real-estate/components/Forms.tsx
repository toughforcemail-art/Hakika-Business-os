"use client";

import { useState } from "react";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { createProperty, updatePropertyAction, createUnit, updateUnitAction, createAsset } from "../actions";
import type { AssetInput, PropertyInput, UnitInput } from "../schemas";

type Value = string | number | boolean | undefined;
type PropertyOption = { id: string; name: string; property_code: string };

const Field = ({ label, name, defaultValue, type = "text", required = false, wide = false }: {
  label: string;
  name: string;
  defaultValue?: Value;
  type?: string;
  required?: boolean;
  wide?: boolean;
}) => (
  <label className={`re-field ${wide ? "wide" : ""}`}>
    <span>{label}{required && " *"}</span>
    {type === "textarea"
      ? <textarea name={name} defaultValue={String(defaultValue ?? "")} required={required} />
      : <input name={name} type={type} defaultValue={typeof defaultValue === "boolean" ? undefined : defaultValue} required={required} />}
  </label>
);

const Select = ({ label, name, value, options, allowCustom = false }: { label: string; name: string; value?: string; options: string[]; allowCustom?: boolean }) => {
  const initialCustom = Boolean(value && !options.includes(value));
  const [selected, setSelected] = useState(initialCustom ? "__custom__" : (value ?? options[0] ?? ""));
  const [customValue, setCustomValue] = useState(initialCustom ? value : "");
  const visibleOptions = Array.from(new Set(options));
  return <label className="re-field">
    <span>{label}</span>
    <select name={name} value={selected} onChange={(event) => { setSelected(event.target.value); if (event.target.value !== "__custom__") setCustomValue(""); }}>
      {visibleOptions.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
      {allowCustom && <option value="__custom__">Other</option>}
    </select>
    {allowCustom && selected === "__custom__" && <input name={`${name}_custom`} value={customValue ?? ""} onChange={(event) => setCustomValue(event.target.value)} placeholder={`Enter ${label.toLowerCase()}`} required />}
  </label>;
};

const Check = ({ label, name, checked }: { label: string; name: string; checked?: boolean }) => (
  <label className="re-check">
    <input name={name} type="checkbox" defaultChecked={checked} />
    {label}
  </label>
);

const PropertySelect = ({ value, properties }: { value?: string; properties: PropertyOption[] }) => (
  <label className="re-field">
    <span>Property *</span>
    <select name="property_id" defaultValue={value} required>
      <option value="">Choose a property</option>
      {properties.map((property) => (
        <option key={property.id} value={property.id}>{property.name} ({property.property_code})</option>
      ))}
    </select>
  </label>
);

const OptionalAmount = ({ label, name, amountName, checked, amount }: {
  label: string;
  name: string;
  amountName: string;
  checked?: boolean;
  amount?: number;
}) => {
  const [enabled, setEnabled] = useState(Boolean(checked || amount));
  return (
    <div className="re-optional-field">
      <label className="re-check">
        <input name={name} type="checkbox" defaultChecked={enabled} onChange={(event) => setEnabled(event.currentTarget.checked)} />
        {label}
      </label>
      {enabled && <Field label={`${label} amount`} name={amountName} type="number" defaultValue={amount} />}
    </div>
  );
};

function useAction<T>(action: (input: T) => Promise<{ errors?: Record<string, string> } | void>) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return {
    error,
    pending,
    submit: async (input: T) => {
      setError("");
      setPending(true);
      try {
        const result = await action(input);
        if (result?.errors) {
          setError(Object.entries(result.errors).map(([field, message]) =>
            field === "form" ? message : `${field.replaceAll("_", " ")}: ${message}`
          ).join(" | "));
        }
      } catch (caught) {
        if (isRedirectError(caught)) throw caught;
        setError("The form could not be saved. Check the entered details and try again.");
      } finally {
        setPending(false);
      }
    },
  };
}

const num = (value: FormDataEntryValue | null) => value == null || value === "" ? undefined : Number(value);
const selectValue = (form: FormData, name: string) => form.get(name) === "__custom__" ? String(form.get(`${name}_custom`) ?? "").trim() : String(form.get(name) ?? "");

export function PropertyForm({ initial, id, customPropertyTypes = [] }: { initial?: Partial<PropertyInput>; id?: string; customPropertyTypes?: string[] }) {
  const action = useAction<PropertyInput>(id ? (input) => updatePropertyAction(id, input) : createProperty);

  return (
    <form className="re-form" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      await action.submit({
        property_code: String(form.get("property_code") ?? ""),
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? ""),
        property_type: selectValue(form, "property_type") || "residential",
        status: String(form.get("status") ?? "active"),
        registration_number: String(form.get("registration_number") ?? ""),
        address_line_1: String(form.get("address_line_1") ?? ""),
        address_line_2: String(form.get("address_line_2") ?? ""),
        county: String(form.get("county") ?? ""),
        city_or_town: String(form.get("city_or_town") ?? ""),
        location: String(form.get("location") ?? ""),
        sub_location: String(form.get("sub_location") ?? ""),
        postal_code: String(form.get("postal_code") ?? ""),
        year_built: num(form.get("year_built")),
        total_floors: num(form.get("total_floors")),
        planned_unit_count: num(form.get("planned_unit_count")) ?? 0,
        planned_unit_mix: String(form.get("planned_unit_mix") ?? ""),
        base_rent_amount: num(form.get("base_rent_amount")),
        currency: String(form.get("currency") ?? "KES"),
        payment_frequency: String(form.get("payment_frequency") ?? "monthly"),
        late_payment_penalty_rate: num(form.get("late_payment_penalty_rate")),
        grace_period_days: num(form.get("grace_period_days")),
        service_fee_mode: String(form.get("service_fee_mode") ?? "none"),
        service_fee_value: num(form.get("service_fee_value")),
        water_included: form.get("water_included") === "on",
        electricity_included: form.get("electricity_included") === "on",
        internet_included: form.get("internet_included") === "on",
        security_deposit_months: num(form.get("security_deposit_months")),
        water_deposit_amount: num(form.get("water_deposit_amount")),
        electricity_deposit_amount: num(form.get("electricity_deposit_amount")),
        electricity_bill_amount: num(form.get("electricity_bill_amount")),
        water_bill_amount: num(form.get("water_bill_amount")),
        keys_deposit_amount: num(form.get("keys_deposit_amount")),
        manager_name: String(form.get("manager_name") ?? ""),
        manager_phone: String(form.get("manager_phone") ?? ""),
        manager_email: String(form.get("manager_email") ?? ""),
        emergency_contact: String(form.get("emergency_contact") ?? ""),
        office_hours: String(form.get("office_hours") ?? ""),
        amenities: String(form.get("amenities") ?? ""),
        inspection_required_on_move_in: form.get("inspection_required_on_move_in") === "on",
        inspection_required_on_move_out: form.get("inspection_required_on_move_out") === "on",
        auto_generate_inspection_report: form.get("auto_generate_inspection_report") === "on",
        property_config: JSON.stringify({
          total_bedrooms: num(form.get("total_bedrooms")),
          deposit_paid_to: String(form.get("deposit_paid_to") ?? "landlord"),
          rent_paid_to: String(form.get("rent_paid_to") ?? "landlord"),
          late_penalty_enabled: form.get("late_penalty_enabled") === "on",
          billing_day: num(form.get("billing_day")) ?? 1,
          billing_time: String(form.get("billing_time") ?? "08:00"),
          due_day_rule: String(form.get("due_day_rule") ?? "invoice_day"),
          due_day_offset: num(form.get("due_day_offset")) ?? 0,
          due_month_mode: String(form.get("due_month_mode") ?? "same_month"),
          water_config: String(form.get("water_config") ?? "not_charged"),
          water_fixed_amount: num(form.get("water_fixed_amount")) ?? 0,
          electricity_config: String(form.get("electricity_config") ?? "not_charged"),
          electricity_fixed_amount: num(form.get("electricity_fixed_amount")) ?? 0,
          garbage_config: String(form.get("garbage_config") ?? "not_charged"),
          garbage_fixed_amount: num(form.get("garbage_fixed_amount")) ?? 0,
          internet_config: String(form.get("internet_config") ?? "not_charged"),
          internet_fixed_amount: num(form.get("internet_fixed_amount")) ?? 0,
          service_charge_notes: String(form.get("service_charge_notes") ?? ""),
          notify_email: form.get("notify_email") === "on",
          notify_sms: form.get("notify_sms") === "on",
          invoice_channels: form.getAll("invoice_channels"),
        }),
      });
    }}>
      <section className="re-form-section">
        <h2>General information</h2>
        <div className="re-form-grid">
          <Field label="Property name" name="name" defaultValue={initial?.name} required />
          <Field label="Property code (optional)" name="property_code" defaultValue={initial?.property_code} />
          <Select label="Property type" name="property_type" value={initial?.property_type} options={["residential", "commercial", "mixed_use", "land", ...customPropertyTypes]} allowCustom />
          <Select label="Status" name="status" value={initial?.status ?? "active"} options={["active", "inactive"]} />
          <Field label="Registration number" name="registration_number" defaultValue={initial?.registration_number} />
          <Field label="Year built" name="year_built" type="number" defaultValue={initial?.year_built} />
          <Field label="Total floors" name="total_floors" type="number" defaultValue={initial?.total_floors} />
          <Field label="Description" name="description" type="textarea" defaultValue={initial?.description} wide />
        </div>
      </section>
      <section className="re-form-section">
        <h2>Location</h2>
        <div className="re-form-grid">
          <Field label="Address line 1" name="address_line_1" defaultValue={initial?.address_line_1} />
          <Field label="Address line 2" name="address_line_2" defaultValue={initial?.address_line_2} />
          <Field label="County" name="county" defaultValue={initial?.county} />
          <Field label="City or town" name="city_or_town" defaultValue={initial?.city_or_town} />
          <Field label="Location" name="location" defaultValue={initial?.location} />
          <Field label="Sub-location" name="sub_location" defaultValue={initial?.sub_location} />
          <Field label="Postal code" name="postal_code" defaultValue={initial?.postal_code} />
        </div>
      </section>
      <section className="re-form-section">
        <h2>Planned mix and financial defaults</h2>
        <div className="re-form-grid">
          <Field label="Planned units" name="planned_unit_count" type="number" defaultValue={initial?.planned_unit_count ?? 0} />
          <Field label="Planned unit mix (JSON)" name="planned_unit_mix" defaultValue={initial?.planned_unit_mix} />
          <Field label="Base rent" name="base_rent_amount" type="number" defaultValue={initial?.base_rent_amount} />
          <Field label="Currency" name="currency" defaultValue={initial?.currency ?? "KES"} />
          <Select label="Payment frequency" name="payment_frequency" value={initial?.payment_frequency ?? "monthly"} options={["monthly", "quarterly", "annually"]} />
          <Field label="Late penalty rate (%)" name="late_payment_penalty_rate" type="number" defaultValue={initial?.late_payment_penalty_rate} />
          <Field label="Grace period (days)" name="grace_period_days" type="number" defaultValue={initial?.grace_period_days} />
          <Select label="Service fee mode" name="service_fee_mode" value={initial?.service_fee_mode ?? "none"} options={["none", "fixed", "percentage"]} />
          <Field label="Service fee value" name="service_fee_value" type="number" defaultValue={initial?.service_fee_value} />
          <Field label="Security deposit (months)" name="security_deposit_months" type="number" defaultValue={initial?.security_deposit_months} />
          <Field label="Water deposit" name="water_deposit_amount" type="number" defaultValue={initial?.water_deposit_amount} />
          <Field label="Electricity deposit" name="electricity_deposit_amount" type="number" defaultValue={initial?.electricity_deposit_amount} />
        </div>
      </section>
      <section className="re-form-section">
        <h2>Property settings</h2>
        <div className="re-form-grid">
          <Field label="Total bedrooms" name="total_bedrooms" type="number" />
          <Select label="Deposit paid to" name="deposit_paid_to" options={["landlord", "agent"]} />
          <Select label="Rent paid to" name="rent_paid_to" options={["landlord", "agent"]} />
          <Field label="Billing day" name="billing_day" type="number" defaultValue={1} />
          <Field label="Billing time" name="billing_time" type="time" defaultValue="08:00" />
          <Select label="Due day rule" name="due_day_rule" options={["invoice_day", "days_after_invoice", "same_day_next_month", "end_of_invoice_month"]} />
          <Field label="Due offset (days)" name="due_day_offset" type="number" defaultValue={0} />
          <Select label="Due month mode" name="due_month_mode" options={["same_month", "next_month"]} />
          <Select label="Water billing" name="water_config" options={["not_charged", "metered", "fixed"]} />
          <Field label="Water fixed amount" name="water_fixed_amount" type="number" defaultValue={0} />
          <Select label="Electricity" name="electricity_config" options={["not_charged", "metered", "fixed"]} />
          <Field label="Electricity fixed amount" name="electricity_fixed_amount" type="number" defaultValue={0} />
          <Select label="Garbage collection" name="garbage_config" options={["not_charged", "metered", "fixed"]} />
          <Field label="Garbage fixed amount" name="garbage_fixed_amount" type="number" defaultValue={0} />
          <Select label="Internet" name="internet_config" options={["not_charged", "metered", "fixed"]} />
          <Field label="Internet fixed amount" name="internet_fixed_amount" type="number" defaultValue={0} />
          <Field label="Service charge notes" name="service_charge_notes" type="textarea" wide />
          <Check name="late_penalty_enabled" label="Enable late payment penalty" />
          <Check name="notify_email" label="Email auto notifications" checked />
          <Check name="notify_sms" label="SMS auto notifications" />
        </div>
        <div className="re-check-group"><span>Invoice delivery channels</span><label className="re-check"><input name="invoice_channels" type="checkbox" value="email" defaultChecked /> Email</label><label className="re-check"><input name="invoice_channels" type="checkbox" value="sms" /> SMS</label><label className="re-check"><input name="invoice_channels" type="checkbox" value="whatsapp" /> WhatsApp</label></div>
      </section>
      <section className="re-form-section">
        <h2>Utilities, amenities and management</h2>
        <div className="re-form-grid">
          <OptionalAmount name="electricity_included" label="Electricity" amountName="electricity_bill_amount" checked={initial?.electricity_included} amount={initial?.electricity_bill_amount} />
          <OptionalAmount name="water_included" label="Water bill" amountName="water_bill_amount" checked={initial?.water_included} amount={initial?.water_bill_amount} />
          <OptionalAmount name="keys_deposit_enabled" label="Keys deposit" amountName="keys_deposit_amount" amount={initial?.keys_deposit_amount} />
          <Field label="Amenities (comma separated)" name="amenities" defaultValue={Array.isArray(initial?.amenities) ? initial.amenities.join(", ") : initial?.amenities} />
          <Field label="Manager name" name="manager_name" defaultValue={initial?.manager_name} />
          <Field label="Manager phone" name="manager_phone" defaultValue={initial?.manager_phone} />
          <Field label="Manager email" name="manager_email" defaultValue={initial?.manager_email} />
          <Field label="Emergency contact" name="emergency_contact" defaultValue={initial?.emergency_contact} />
          <Field label="Office hours" name="office_hours" defaultValue={initial?.office_hours} />
          <Check name="inspection_required_on_move_in" label="Inspect on move-in" checked={initial?.inspection_required_on_move_in ?? true} />
          <Check name="inspection_required_on_move_out" label="Inspect on move-out" checked={initial?.inspection_required_on_move_out ?? true} />
          <Check name="auto_generate_inspection_report" label="Auto-generate inspection report" checked={initial?.auto_generate_inspection_report} />
        </div>
      </section>
      {action.error && <p className="re-form-error" role="alert">{action.error}</p>}
      <button className="re-button primary" disabled={action.pending}>{action.pending ? "Saving..." : id ? "Save property" : "Create property"}</button>
    </form>
  );
}

export function UnitForm({ initial, id, propertyId, properties = [], customUnitTypes = [] }: {
  initial?: Partial<UnitInput>;
  id?: string;
  propertyId?: string;
  properties?: PropertyOption[];
  customUnitTypes?: string[];
}) {
  const action = useAction<UnitInput>(id ? (input) => updateUnitAction(id, input) : createUnit);

  return (
    <form className="re-form" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      await action.submit({
        property_id: String(form.get("property_id") ?? propertyId ?? ""),
        unit_number: String(form.get("unit_number") ?? ""),
        unit_type: selectValue(form, "unit_type") || "residential",
        monthly_rent: Number(form.get("monthly_rent") ?? 0),
        currency: String(form.get("currency") ?? "KES"),
        floor_number: num(form.get("floor_number")),
        size_value: num(form.get("size_value")),
        size_unit: String(form.get("size_unit") ?? "sqm"),
        electricity_bill_amount: num(form.get("electricity_bill_amount")),
        water_bill_amount: num(form.get("water_bill_amount")),
        keys_deposit_amount: num(form.get("keys_deposit_amount")),
        rent_deposit_amount: num(form.get("rent_deposit_amount")),
        bedrooms: num(form.get("bedrooms")),
        bathrooms: num(form.get("bathrooms")),
        status: String(form.get("status") ?? "vacant"),
        has_parking: form.get("has_parking") === "on",
        parking_number: String(form.get("parking_number") ?? ""),
        notes: String(form.get("description") ?? ""),
        unit_config: JSON.stringify({
          floor_label: String(form.get("floor_label") ?? ""),
          last_water_reading: num(form.get("last_water_reading")) ?? 0,
          last_electricity_reading: num(form.get("last_electricity_reading")) ?? 0,
          garbage_amount: num(form.get("garbage_amount")) ?? 0,
          internet_amount: num(form.get("internet_amount")) ?? 0,
          features: String(form.get("features") ?? ""),
        }),
      });
    }}>
      <section className="re-form-section">
        <h2>Unit identity</h2>
        <div className="re-form-grid">
          <PropertySelect value={initial?.property_id ?? propertyId} properties={properties} />
          <Field label="Unit number" name="unit_number" defaultValue={initial?.unit_number} required />
          <Select label="Unit type" name="unit_type" value={initial?.unit_type ?? "1BR"} options={["single_room", "studio", "1BR", "2BR", "3BR", "4BR", "commercial", "office", "shop", "residential", "parking", ...customUnitTypes]} allowCustom />
          <Select label="Status" name="status" value={initial?.status ?? "vacant"} options={["vacant", "reserved", "maintenance", "occupied"]} />
        </div>
      </section>
      <section className="re-form-section">
        <h2>Rent and physical details</h2>
        <div className="re-form-grid">
          <Field label="Monthly rent" name="monthly_rent" type="number" defaultValue={initial?.monthly_rent ?? 0} />
          <Field label="Currency" name="currency" defaultValue={initial?.currency ?? "KES"} />
          <Field label="Bedrooms" name="bedrooms" type="number" defaultValue={initial?.bedrooms} />
          <Field label="Bathrooms" name="bathrooms" type="number" defaultValue={initial?.bathrooms} />
          <Field label="Floor / location" name="floor_label" />
          <Field label="Floor number" name="floor_number" type="number" defaultValue={initial?.floor_number} />
          <Field label="Distinctive features" name="features" />
          <Field label="Internal description / notes" name="description" type="textarea" wide />
        </div>
      </section>
      <section className="re-form-section">
        <h2>Utilities</h2>
        <div className="re-form-grid">
          <OptionalAmount name="electricity_bill_enabled" label="Electricity bill" amountName="electricity_bill_amount" amount={initial?.electricity_bill_amount} />
          <OptionalAmount name="water_bill_enabled" label="Water bill" amountName="water_bill_amount" amount={initial?.water_bill_amount} />
          <OptionalAmount name="keys_deposit_enabled" label="Keys deposit" amountName="keys_deposit_amount" amount={initial?.keys_deposit_amount} />
          <OptionalAmount name="rent_deposit_enabled" label="Rent deposit" amountName="rent_deposit_amount" amount={initial?.rent_deposit_amount} />
          <Field label="Initial water meter reading" name="last_water_reading" type="number" defaultValue={0} />
          <Field label="Initial electricity meter reading" name="last_electricity_reading" type="number" defaultValue={0} />
          <Field label="Monthly garbage charge" name="garbage_amount" type="number" defaultValue={0} />
          <Field label="Monthly internet charge" name="internet_amount" type="number" defaultValue={0} />
        </div>
      </section>
      <section className="re-form-section">
        <h2>Parking and unit notes</h2>
        <div className="re-form-grid">
          <Check name="has_parking" label="Has parking" checked={initial?.has_parking} />
          <Field label="Parking number" name="parking_number" defaultValue={initial?.parking_number} />
        </div>
      </section>
      {action.error && <p className="re-form-error" role="alert">{action.error}</p>}
      <button className="re-button primary" disabled={action.pending}>{action.pending ? "Saving..." : id ? "Save unit" : "Create unit"}</button>
    </form>
  );
}

export function AssetForm({ unitId }: { unitId: string }) {
  const action = useAction<AssetInput>(createAsset);
  return (
    <form className="re-form" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      await action.submit({
        unit_id: unitId,
        asset_name: String(form.get("asset_name") ?? ""),
        asset_category: String(form.get("asset_category") ?? ""),
        serial_number: String(form.get("serial_number") ?? ""),
        condition: String(form.get("condition") ?? "good"),
        quantity: Number(form.get("quantity") ?? 1),
        status: String(form.get("status") ?? "active"),
      });
    }}>
      <Field label="Asset name" name="asset_name" required />
      <Field label="Category" name="asset_category" />
      <Field label="Serial number" name="serial_number" />
      <Select label="Condition" name="condition" options={["new", "good", "fair", "poor", "damaged"]} />
      <Field label="Quantity" name="quantity" type="number" defaultValue={1} />
      <Select label="Status" name="status" options={["active", "missing", "disposed", "inactive"]} />
      {action.error && <p className="re-form-error" role="alert">{action.error}</p>}
      <button className="re-button primary" disabled={action.pending}>{action.pending ? "Saving..." : "Add asset"}</button>
    </form>
  );
}
