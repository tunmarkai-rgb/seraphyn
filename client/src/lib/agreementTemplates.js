export const AGREEMENT_TEMPLATES = {
  direct_hire: {
    documentType: 'direct_hire',
    title: 'Direct Hire Agreement',
    subtitle: 'Seraphyn Care Solutions Direct Hire Services',
    intro:
      'This agreement governs direct-hire recruiting and placement services between Seraphyn Care Solutions and your organization.',
    sections: [
      {
        heading: 'Parties and Effective Date',
        paragraphs: [
          'This Direct Hire Agreement is entered into between Seraphyn Care Solutions and the employer identified below for the purpose of sourcing, screening, and presenting healthcare candidates for direct placement.',
          'The employer confirms that the signer completing this agreement is authorized to bind the organization.'
        ]
      },
      {
        heading: 'Service Scope',
        paragraphs: [
          'Seraphyn will recruit, evaluate, and present qualified healthcare professionals for permanent placement opportunities requested by the employer.',
          'The employer remains responsible for final interviews, offer decisions, onboarding, and all role-specific internal compliance after hire.'
        ]
      },
      {
        heading: 'Placement Fees and Replacement Terms',
        paragraphs: [
          'Direct hire placement fees, payment timing, and any replacement provisions are governed by the executed commercial terms between the parties and the active requisition submitted through Seraphyn.',
          'The employer agrees not to circumvent Seraphyn by engaging introduced candidates outside the agreed placement process.'
        ]
      },
      {
        heading: 'Confidentiality and Candidate Handling',
        paragraphs: [
          'Candidate information shared by Seraphyn is confidential and must be used solely for evaluating placement opportunities within the employer organization.',
          'The employer will not distribute candidate profiles to third parties without written authorization.'
        ]
      }
    ],
    acknowledgements: [
      'My organization is engaging Seraphyn for direct-hire recruiting support.',
      'I am authorized to sign this agreement on behalf of the employer.',
      'Candidate information provided by Seraphyn will be handled confidentially.'
    ]
  },
  staffing_boss: {
    documentType: 'staffing_boss',
    title: 'Per Diem Staffing Agreement',
    subtitle: 'Back Office Staffing Solutions (BOSS) Employer-of-Record Services',
    intro:
      'This agreement governs temporary and per-diem staffing services coordinated by Seraphyn Care Solutions with BOSS serving as Employer of Record for temporary staff.',
    sections: [
      {
        heading: 'Parties and Staffing Model',
        paragraphs: [
          'Seraphyn Care Solutions coordinates staffing services for the employer organization. Back Office Staffing Solutions (BOSS) serves as Employer of Record for temporary clinicians assigned through this program.',
          'This model is designed to support compliant placement, payroll administration, and rapid staffing response.'
        ]
      },
      {
        heading: 'Payroll, Insurance, and Compliance',
        paragraphs: [
          'BOSS handles payroll administration, tax withholding, workers compensation, and related employer-of-record obligations for temporary staff provided under this program.',
          'The employer remains responsible for onsite supervision, scheduling, time confirmation, and facility-specific clinical compliance requirements.'
        ]
      },
      {
        heading: 'Timekeeping and Invoicing',
        paragraphs: [
          'Approved worked hours and staffing utilization will be tracked through the staffing process agreed between the parties and used for employer invoicing.',
          'The employer agrees to review and confirm time records promptly so payroll and billing can be processed accurately.'
        ]
      },
      {
        heading: 'Operational Cooperation',
        paragraphs: [
          'The employer will provide safe working conditions, orientation information, unit expectations, and timely communication regarding schedule changes or assignment issues.',
          'Seraphyn and BOSS may rely on employer-provided scheduling, attendance, and time confirmation data for operational and billing purposes.'
        ]
      }
    ],
    acknowledgements: [
      'I understand that BOSS serves as Employer of Record for temporary staff provided through this program.',
      'My organization is responsible for onsite supervision, scheduling, and time confirmation.',
      'I am authorized to sign this agreement on behalf of the employer.'
    ]
  }
}

export const AGREEMENT_ORDER = ['direct_hire', 'staffing_boss']
