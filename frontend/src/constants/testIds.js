export const HOME = { emergentLink: "home-emergent-link" };

export const TID = {
  // landing/login
  landingCtaLogin: "landing-cta-login",
  landingCtaRegister: "landing-cta-register",
  loginEmail: "login-email",
  loginPassword: "login-password",
  loginSubmit: "login-submit",
  registerName: "register-name",
  registerEmail: "register-email",
  registerPassword: "register-password",
  registerSubmit: "register-submit",
  authToggle: "auth-toggle",
  demoFill: (role) => `demo-fill-${role}`,
  // shell
  shellLogout: "shell-logout",
  shellNav: (key) => `shell-nav-${key}`,
  // patient
  patientBookBtn: "patient-book-appointment-button",
  patientTherapistSelect: "patient-therapist-select",
  patientPayBtn: (id) => `patient-pay-${id}`,
  patientReceiptBtn: (id) => `patient-receipt-${id}`,
  // receptionist
  recSearch: "receptionist-search-input",
  recCreatePatient: "receptionist-create-patient-button",
  recCreateAppt: "receptionist-create-appointment-button",
  // therapist
  therapistOpenRecord: (id) => `therapist-open-record-${id}`,
  therapistSaveNotes: "therapist-save-notes",
  // manager
  managerKpi: (key) => `manager-kpi-${key}`,
  // admin
  adminAddUser: "admin-add-user-button",
  adminEditUser: (id) => `admin-edit-user-${id}`,
  adminDeleteUser: (id) => `admin-delete-user-${id}`,
};
