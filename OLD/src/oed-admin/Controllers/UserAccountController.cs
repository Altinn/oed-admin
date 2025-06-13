using Microsoft.AspNetCore.Mvc;

namespace oed_admin.Controllers
{
    [Route("api/[controller]")]
    public class UserAccountController : Controller
    {
        private ILogger<UserAccountController> _logger;

        // public UserAccountController(ILogger<UserAccountController> logger) => _logger = logger;

        [HttpGet]
        public IActionResult Get()
        {
            var userName = Request.Headers["X-MS-CLIENT-PRINCIPAL-NAME"].ToString();
            var userId = Request.Headers["X-MS-CLIENT-PRINCIPAL-ID"].ToString();

            return Ok(new
            {
                UserName = userName,
                ObjectId = userId
            });
        }

        [HttpPost("update")]   // POST /profile/update
        public IActionResult UpdateProfile() => Ok();
    }
}