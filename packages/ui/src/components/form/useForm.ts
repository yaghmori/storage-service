import { createFormHook, createFormHookContexts } from "@tanstack/react-form"
import { FormCheckbox } from "./form-checkbox"
import { FormDateTimePicker } from "./form-datetime-picker"
import { FormFileUploader } from "./form-file-uploader"
import { FormImageUploader } from "./form-image-uploader"
import { FormInput } from "./form-input"
import { FormMultiSelect } from "./form-multi-select"
import { FormPassword } from "./form-password"
import { FormRadioGroup } from "./form-radio-group"
import { FormSelect } from "./form-select"
import { FormTextarea } from "./form-textarea"
import { FormYesNo } from "./form-yes-no"

const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts()

const { useAppForm } = createFormHook({
  fieldComponents: {
    Input: FormInput,
    Textarea: FormTextarea,
    Select: FormSelect,
    Checkbox: FormCheckbox,
    RadioGroup: FormRadioGroup,
    MultiSelect: FormMultiSelect,
    DateTimePicker: FormDateTimePicker,
    ImageUploader: FormImageUploader,
    FileUploader: FormFileUploader,
    Password: FormPassword,
    YesNo: FormYesNo,
  },
  formComponents: {},
  fieldContext,
  formContext,
})

export { useAppForm, useFieldContext, useFormContext }

