/**
 * NPRM Forward-Compatibility Tool
 * 
 * Checks if triggered controls are affected by the 2024 HIPAA Security Rule NPRM
 * and returns forward-compatibility narratives.
 */

interface NPRMProposedChange {
  change_id: string;
  title: string;
  summary: string;
  affects_controls: string[];
  bobguard_action: string;
  nprm_reference_section: string;
}

interface NPRMOverlay {
  _meta: {
    name: string;
    source: string;
    framing_disclaimer: string;
  };
  proposed_changes: NPRMProposedChange[];
}

interface ForwardCompatResult {
  control_id: string;
  existing_status: 'addressable' | 'required';
  nprm_proposal: string;
  bobguard_action: string;
  nprm_reference_section: string;
}

/**
 * Creates the nprm.forward_compat_check tool handler
 */
export function createNPRMForwardCompatCheckTool(
  nprm_overlay: NPRMOverlay,
  controlsMap: Map<string, any>
) {
  return (args: { triggered_controls: Array<{ control_id: string }> }) => {
    const { triggered_controls } = args;

    const results: ForwardCompatResult[] = [];

    // For each triggered control, check if it's affected by any NPRM proposed change
    for (const { control_id } of triggered_controls) {
      for (const change of nprm_overlay.proposed_changes) {
        if (change.affects_controls.includes(control_id)) {
          // Get the control to determine its existing status
          const control = controlsMap.get(control_id);
          
          // Determine existing status from control name
          let existing_status: 'addressable' | 'required' = 'required';
          if (control && control.control_name) {
            if (control.control_name.toLowerCase().includes('addressable')) {
              existing_status = 'addressable';
            }
          }

          results.push({
            control_id,
            existing_status,
            nprm_proposal: change.summary,
            bobguard_action: change.bobguard_action,
            nprm_reference_section: change.nprm_reference_section,
          });

          // Only include each control once (first matching change)
          break;
        }
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  };
}

// Made with Bob
