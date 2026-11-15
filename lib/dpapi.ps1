param(
    [Parameter(Mandatory = $true)][ValidateSet('encrypt', 'decrypt')][string]$Mode,
    [Parameter(Mandatory = $true)][string]$InPath,
    [Parameter(Mandatory = $true)][string]$OutPath
)

$ErrorActionPreference = 'Stop'

if ($Mode -eq 'encrypt') {
    $plain = [System.IO.File]::ReadAllText($InPath, [System.Text.Encoding]::UTF8)
    $secure = ConvertTo-SecureString -String $plain -AsPlainText -Force
    # Without -Key this uses Windows DPAPI, bound to the current Windows user.
    $encrypted = ConvertFrom-SecureString -SecureString $secure
    [System.IO.File]::WriteAllText($OutPath, $encrypted, [System.Text.Encoding]::UTF8)
}
else {
    $encrypted = [System.IO.File]::ReadAllText($OutPath, [System.Text.Encoding]::UTF8)
    $secure = ConvertTo-SecureString -String $encrypted
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    [System.IO.File]::WriteAllText($InPath, $plain, [System.Text.Encoding]::UTF8)
}
